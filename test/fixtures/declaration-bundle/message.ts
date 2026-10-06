export interface Message {
  value: string
}

export function createMessage(value: string): Message {
  const ambient: AmbientMessage = { label: value }
  const automatic: AutoIncludedMessage = { enabled: true }
  return { value: automatic.enabled ? ambient.label : value }
}
