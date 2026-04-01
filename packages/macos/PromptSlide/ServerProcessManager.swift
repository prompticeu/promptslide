import Foundation

@MainActor
class ServerProcessManager: ObservableObject {
    enum State: Equatable {
        case starting
        case ready
        case failed(String)
    }

    @Published var state: State = .starting
    @Published var devServerURL: URL?
    @Published var mcpServerURL: URL?

    private var process: Process?
    private var stderrBuffer = ""

    private static let deckRoot: URL = {
        FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent(".promptslide")
            .appendingPathComponent("decks")
    }()

    /// In dev mode, resolve the CLI entry point from the monorepo source.
    /// Set the PROMPTSLIDE_CLI_PATH env var or Xcode scheme env to override.
    private static func resolveCliEntry() -> (executable: String, args: [String])? {
        // 1. Explicit override via environment
        if let cliPath = ProcessInfo.processInfo.environment["PROMPTSLIDE_CLI_PATH"] {
            return ("node", [cliPath])
        }

        // 2. Dev mode: walk up from the app binary to find the monorepo CLI
        //    The Xcode build products are in DerivedData, but the source is in packages/macos/
        //    We use the compile-time #file to locate the monorepo.
        #if DEBUG
        let thisFile = URL(fileURLWithPath: #file)
        // thisFile = .../packages/macos/PromptSlide/ServerProcessManager.swift
        // monorepo root = 3 levels up
        let monorepoRoot = thisFile
            .deletingLastPathComponent() // PromptSlide/
            .deletingLastPathComponent() // macos/
            .deletingLastPathComponent() // packages/
            .deletingLastPathComponent() // repo root
        let cliEntry = monorepoRoot
            .appendingPathComponent("packages")
            .appendingPathComponent("cli")
            .appendingPathComponent("src")
            .appendingPathComponent("index.mjs")
        if FileManager.default.fileExists(atPath: cliEntry.path) {
            return ("node", [cliEntry.path])
        }
        #endif

        // 3. Release: use globally/locally installed CLI
        return ("node", ["node_modules/.bin/promptslide"])
    }

    func start() {
        state = .starting
        devServerURL = nil
        mcpServerURL = nil
        stderrBuffer = ""

        let deckRoot = Self.deckRoot
        try? FileManager.default.createDirectory(at: deckRoot, withIntermediateDirectories: true)

        guard let cli = Self.resolveCliEntry() else {
            state = .failed("Could not find promptslide CLI")
            return
        }

        let process = Process()
        // Use /usr/bin/env to resolve node from PATH
        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        process.arguments = [cli.executable] + cli.args + [
            "studio",
            "--mcp",
            "--transport=http",
            "--json",
            "--port=29171",
            "--mcp-port=29170",
            "--deck-root=\(deckRoot.path)",
        ]
        process.currentDirectoryURL = deckRoot

        // Inherit PATH from user's shell so node can be found
        var env = ProcessInfo.processInfo.environment
        if let shellPath = resolveShellPath() {
            env["PATH"] = shellPath
        }
        process.environment = env

        let stderrPipe = Pipe()
        let stdoutPipe = Pipe()
        process.standardOutput = stdoutPipe
        process.standardError = stderrPipe

        stdoutPipe.fileHandleForReading.readabilityHandler = { handle in
            let data = handle.availableData
            if let text = String(data: data, encoding: .utf8), !text.isEmpty {
                print("[PromptSlide stdout] \(text)")
            }
        }

        stderrPipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty, let chunk = String(data: data, encoding: .utf8) else { return }
            print("[PromptSlide stderr] \(chunk)")
            Task { @MainActor [weak self] in
                self?.handleStderr(chunk)
            }
        }

        process.terminationHandler = { [weak self] proc in
            Task { @MainActor [weak self] in
                guard let self, self.state != .ready else { return }
                self.state = .failed("Server exited with code \(proc.terminationStatus)")
            }
        }

        let fullCommand = ([cli.executable] + cli.args + [
            "studio", "--mcp", "--transport=http", "--json",
            "--port=29171", "--mcp-port=29170", "--deck-root=\(deckRoot.path)",
        ]).joined(separator: " ")
        print("[PromptSlide] Starting: \(fullCommand)")
        print("[PromptSlide] CWD: \(deckRoot.path)")

        do {
            try process.run()
            self.process = process
            print("[PromptSlide] Process launched, PID: \(process.processIdentifier)")
        } catch {
            print("[PromptSlide] Failed to launch: \(error)")
            state = .failed("Failed to start server: \(error.localizedDescription)")
        }
    }

    func stop() {
        guard let process, process.isRunning else { return }
        process.terminate()
        DispatchQueue.global().asyncAfter(deadline: .now() + 2) { [weak self] in
            if self?.process?.isRunning == true {
                self?.process?.interrupt()
            }
        }
    }

    func restart() {
        stop()
        start()
    }

    // MARK: - Private

    private func handleStderr(_ chunk: String) {
        stderrBuffer += chunk
        // Process complete lines
        while let newlineRange = stderrBuffer.range(of: "\n") {
            let line = String(stderrBuffer[stderrBuffer.startIndex..<newlineRange.lowerBound])
            stderrBuffer.removeSubrange(stderrBuffer.startIndex...newlineRange.lowerBound)
            processLine(line)
        }
        // Check remaining buffer for the marker (in case there's no trailing newline yet)
        if stderrBuffer.contains("__PROMPTSLIDE_READY__") {
            processLine(stderrBuffer)
            stderrBuffer = ""
        }
    }

    private func processLine(_ line: String) {
        guard let markerRange = line.range(of: "__PROMPTSLIDE_READY__") else { return }
        let jsonStr = String(line[markerRange.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines)
        guard let data = jsonStr.data(using: .utf8),
              let info = try? JSONDecoder().decode(ServerInfo.self, from: data) else { return }

        devServerURL = URL(string: info.devServer)
        mcpServerURL = URL(string: info.mcpServer)
        state = .ready
    }

    /// Try to get the full PATH from the user's default shell
    private func resolveShellPath() -> String? {
        let shell = ProcessInfo.processInfo.environment["SHELL"] ?? "/bin/zsh"
        let pathProc = Process()
        pathProc.executableURL = URL(fileURLWithPath: shell)
        pathProc.arguments = ["-ilc", "echo $PATH"]
        let pipe = Pipe()
        pathProc.standardOutput = pipe
        pathProc.standardError = FileHandle.nullDevice
        pathProc.standardInput = FileHandle.nullDevice
        do {
            try pathProc.run()
            pathProc.waitUntilExit()
            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            return String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines)
        } catch {
            return nil
        }
    }

    deinit {
        process?.terminate()
    }
}
