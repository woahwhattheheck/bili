export interface Message {
  value: string
}

export function createMessage(value: string): Message {
  const ambient: AmbientMessage = { label: value }
  return { value: ambient.label }
}
