function cleanMinecraftFormatting(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/§x(§[0-9a-fA-F]){6}/g, '')
    .replace(/&x(&[0-9a-fA-F]){6}/g, '')
    .replace(/[§&]#[0-9a-fA-F]{6}/g, '')
    .replace(/[§&][0-9a-fk-orA-FK-OR]/g, '')
    .replace(/§[a-zA-Z0-9]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function parseChatComponent(component) {
  if (component === null || component === undefined) return '';
  if (typeof component === 'string') {
    return cleanMinecraftFormatting(component);
  }
  if (Array.isArray(component)) {
    return component.map(parseChatComponent).join('');
  }
  if (typeof component === 'object') {
    let result = '';
    if (component.text) {
      result += component.text;
    }
    if (Array.isArray(component.extra)) {
      result += component.extra.map(parseChatComponent).join('');
    }
    return cleanMinecraftFormatting(result);
  }
  return String(component);
}

module.exports = {
  cleanMinecraftFormatting,
  parseChatComponent
};
