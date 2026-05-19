const dom = {
  createElement: function (tagName, props = {}, children = []) {
    const el = document.createElement(tagName)
    for (const key in props) {
      if (key === 'className') {
        el.className = props[key]
      } else if (key === 'textContent') {
        el.textContent = props[key]
      } else if (key === 'title') {
        el.title = props[key]
      } else if (key.startsWith('on') && typeof props[key] === 'function') {
        el.addEventListener(key.substring(2).toLowerCase(), props[key])
      } else {
        el.setAttribute(key, props[key])
      }
    }
    if (children) {
      children.forEach(child => {
        if (typeof child === 'string') {
          el.appendChild(document.createTextNode(child))
        } else if (child) {
          el.appendChild(child)
        }
      })
    }
    return el
  },
  createIcon: function (iconName) {
    return dom.createElement('i', { className: 'i ' + iconName })
  },
  createButton: function (props, iconName) {
    const children = []
    if (iconName) {
      children.push(dom.createIcon(iconName))
    }
    return dom.createElement('button', props, children)
  }
}

if (typeof module !== 'undefined') {
  module.exports = dom
}
