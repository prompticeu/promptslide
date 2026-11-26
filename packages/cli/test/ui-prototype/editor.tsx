import { Button } from "@base-ui/react/button"
import { Dialog } from "@base-ui/react/dialog"
import { Field } from "@base-ui/react/field"
import { Input } from "@base-ui/react/input"
import { Select } from "@base-ui/react/select"
import { Slider } from "@base-ui/react/slider"
import { Switch } from "@base-ui/react/switch"
import { Tabs } from "@base-ui/react/tabs"

import "./theme.css"

export function EditorProbe() {
  return (
    <section data-ps-probe>
      <Tabs.Root defaultValue="design">
        <Tabs.List>
          <Tabs.Tab value="design">Design</Tabs.Tab>
          <Tabs.Tab value="arrange">Arrange</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="design">Format controls</Tabs.Panel>
        <Tabs.Panel value="arrange">Position controls</Tabs.Panel>
      </Tabs.Root>
      <Field.Root>
        <Field.Label>Font family</Field.Label>
        <Input defaultValue="Inter" />
        <Field.Description>Font used by the selected element</Field.Description>
        <Field.Error />
      </Field.Root>
      <textarea aria-label="Text content" defaultValue="Slide text" />
      <Select.Root defaultValue="normal">
        <Select.Trigger>
          <Select.Value />
          <Select.Icon>⌄</Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup data-ps-probe className="ps-probe-popup">
              <Select.List>
                <Select.Item value="normal">
                  <Select.ItemText>Normal</Select.ItemText>
                  <Select.ItemIndicator>✓</Select.ItemIndicator>
                </Select.Item>
                <Select.Item value="bold">
                  <Select.ItemText>Bold</Select.ItemText>
                </Select.Item>
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
      <Slider.Root defaultValue={50}>
        <Slider.Label>Opacity</Slider.Label>
        <Slider.Value />
        <Slider.Control>
          <Slider.Track>
            <Slider.Indicator />
            <Slider.Thumb />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
      <Switch.Root aria-label="Show background">
        <Switch.Thumb />
      </Switch.Root>
      <Dialog.Root>
        <Dialog.Trigger>Close editor</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Backdrop />
          <Dialog.Popup data-ps-probe className="ps-probe-popup">
            <Dialog.Title>Save your changes?</Dialog.Title>
            <Dialog.Description>You have unsaved edits.</Dialog.Description>
            <Dialog.Close>Keep editing</Dialog.Close>
            <Button>Discard changes</Button>
            <Button>Save changes</Button>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  )
}
