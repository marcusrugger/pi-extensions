
init:   init-clipboard          \
        init-homeassistant

init-clipboard:
    cd pi-clipboard && pwd && npm install

init-homeassistant:
    cd pi-homeassistant && pwd && npm install
