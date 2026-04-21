const { ipcRenderer } = require('electron')

function cancel () {
  ipcRenderer.send('close-prompt', '')
  window.close()
}

function response () {
  var values = {}

  const inputs = document.querySelectorAll('#input-container input')
  for (var i = 0; i < inputs.length; i++) {
    const input = inputs[i]
    values[input.id] = input.type === 'checkbox' ? input.checked : input.value
  }

  ipcRenderer.send('close-prompt', values)
  window.close()
}

// flip the button order on mac

document.addEventListener('DOMContentLoaded', function() {
  if (navigator.platform === 'MacIntel') {
    document.getElementById('cancel').parentNode.insertBefore(document.getElementById('cancel'), document.getElementById('ok'))
  }
})


window.addEventListener('load', function () {
  var options = ipcRenderer.sendSync('open-prompt', '')
  var params = JSON.parse(options)
  const okLabel = params.okLabel || params.ok || 'OK'
  const cancelLabel = params.cancelLabel || params.cancel || 'Cancel'
  const darkMode = params.darkMode ?? -1
  const values = params.values || []

  if (values && values.length > 0) {
    const inputContainer = document.getElementById('input-container')
    const fieldInputs = []

    values.forEach((value, index) => {
      var input = document.createElement('input')
      input.type = value.type
      input.placeholder = value.placeholder
      input.id = value.id
      if (value.type === 'checkbox') {
        input.checked = !!value.checked
        const row = document.createElement('label')
        row.className = 'prompt-checkbox-row'
        row.setAttribute('for', value.id)
        row.appendChild(input)
        const text = document.createElement('span')
        text.textContent = value.label || value.placeholder || ''
        row.appendChild(text)
        inputContainer.appendChild(row)
      } else {
        inputContainer.appendChild(input)
      }

      if (index < values.length - 1) {
        if (value.type === 'checkbox') {
          input.style.marginBottom = '0'
        } else {
          input.style.marginBottom = '0.4em'
          const br = document.createElement('br')
          inputContainer.appendChild(br)
        }
      }

      fieldInputs.push(input)

      if (index === 0) {
        input.focus()
      }

      input.addEventListener('keydown', function (e) {
        if (e.keyCode === 27) {
          // escape key
          cancel()
        }

        if (e.keyCode === 13) {
          if (index < fieldInputs.length - 1) {
            // focus next input
            fieldInputs[index + 1].focus()
          } else {
            response()
          }
        }
      })
    })
  }

  if (darkMode === 1 || darkMode === true) { document.body.classList.add('dark-mode') }
  if (params.label) {
    document.getElementById('label').textContent = params.label
  } else {
    document.getElementById('label').hidden = true
  }
  document.getElementById('ok').value = okLabel
  document.getElementById('cancel').value = cancelLabel

  document.getElementById('ok').addEventListener('click', response)
  document.getElementById('cancel').addEventListener('click', cancel)
})
