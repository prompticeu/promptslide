// Public hosted transport lifecycle regression; no service credentials or external network.
import assert from "node:assert/strict"
import { mkdtemp, writeFile, symlink, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const root = resolve(import.meta.dirname, "../..")
const require = createRequire(join(root, "packages/cli/package.json"))
const { createServer } = require("vite")
const { chromium } = require("playwright")
const staging = await mkdtemp(join(tmpdir(), "promptslide-hosted-"))
await symlink(join(root, "node_modules"), join(staging, "node_modules"), "dir")
await writeFile(
  join(staging, "index.html"),
  '<div id="root"></div><script type="module" src="/main.jsx"></script>'
)
await writeFile(
  join(staging, "main.jsx"),
  `
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {DownloadMenu} from ${JSON.stringify(join(root, "packages/cli/src/core/export/powerpoint-button.tsx"))};
window.calls=[];
const json=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
const transport=name=>async(path,init={})=>{
  window.calls.push({name,path,method:init.method||'GET'});
  if(path==='')return json({supported:true,token:'test'});
  if(path==='/pptx'){
    if(name==='old')await new Promise(done=>setTimeout(done,200));
    return json({jobId:name});
  }
  if(init.method==='DELETE')return json({status:'cancelled'});
  return json({jobId:name,status:'succeeded',hasFile:false});
};
const old=transport('old'),next=transport('new');
function App(){
  const [changed,setChanged]=useState(false);
  window.switchTransport=()=>setChanged(true);
  return <DownloadMenu disabled={false} onPdf={()=>{}} exportRequest={changed?next:old}/>;
}
createRoot(document.getElementById('root')).render(<App/>);
`
)
const server = await createServer({
  root: staging,
  configFile: false,
  resolve: { dedupe: ["react", "react-dom"] },
  server: { host: "127.0.0.1", port: 0, fs: { allow: [root, staging] } },
  logLevel: "error"
})
let browser
try {
  await server.listen()
  browser = await chromium.launch({ executablePath: process.env.PROMPTSLIDE_CHROMIUM_PATH })
  const page = await browser.newPage()
  const errors = []
  page.on("pageerror", error => errors.push(error.message))
  await page.goto(server.resolvedUrls.local[0])
  const open = async () => {
    await page.getByRole("button", { name: "Download", exact: true }).click()
    await page.getByRole("menuitem", { name: "PowerPoint (.pptx)", exact: true }).click()
    await page.getByRole("button", { name: "Export .pptx", exact: true }).click()
  }
  await open()
  await page.waitForFunction(() => window.calls.some(call => call.path === "/pptx"))
  await page.evaluate(() => window.switchTransport())
  await page.getByRole("dialog").waitFor({ state: "hidden" })
  await page.waitForFunction(() =>
    window.calls.some(call => call.name === "old" && call.method === "DELETE")
  )
  await open()
  await page.getByRole("heading", { name: "PowerPoint exported", exact: true }).waitFor()
  assert.ok(await page.getByRole("button", { name: "Close export", exact: true }).isEnabled())
  const calls = await page.evaluate(() => window.calls)
  assert.ok(calls.some(call => call.name === "new" && call.path === "/pptx"))
  assert.ok(
    !calls.some(call => call.name === "old" && call.path === "/old" && call.method === "GET")
  )
  assert.deepEqual(errors, [])
  console.log(
    "Hosted transport: switching during pending creation cleans up the old job and permits a new export"
  )
} finally {
  await browser?.close()
  await server.close()
  await rm(staging, { recursive: true, force: true })
}
