import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';
import App from './App';

if (Platform.OS === 'web') {
  window.addEventListener('error', (e) => {
    document.body.innerHTML = `<div style="color:red;padding:20px;font-family:monospace;white-space:pre-wrap;font-size:12px"><b>JS ERROR:</b>\n${e.message}\n\n${e.error?.stack || ''}</div>`;
  });
  window.addEventListener('unhandledrejection', (e) => {
    document.body.innerHTML = `<div style="color:red;padding:20px;font-family:monospace;white-space:pre-wrap;font-size:12px"><b>PROMISE ERROR:</b>\n${e.reason}</div>`;
  });
}

registerRootComponent(App);
