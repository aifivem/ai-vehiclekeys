name 'ai-vehiclekeys'
author 'TGIANN'
version '0.1.0'
license 'GPL-3.0-only'
description 'Vehicle keys, locks, lockpicking and hotwiring; qbx_vehiclekeys API'
repository 'https://github.com/aifivem/ai-vehiclekeys'
fx_version 'cerulean'
game 'gta5'
node_version '22'

client_script 'dist/client.js'
server_script 'dist/server.js'


dependencies {
	'/onesync',
	'ai-core',
	'ai-vehicles',
}

files {
	'locales/*.json',
	'data/settings.json',
}
provide 'qbx_vehiclekeys'
