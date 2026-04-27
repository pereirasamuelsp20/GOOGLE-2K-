// index.js
import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';
import App from './App';

// Register Android widget handler BEFORE root component (Android only)
if (Platform.OS === 'android') {
  try {
    const { registerWidgetTaskHandler } = require('react-native-android-widget');
    const { widgetTaskHandler } = require('./widgets/widgetTaskHandler');
    registerWidgetTaskHandler(widgetTaskHandler);
  } catch (e) {
    console.warn('Widget handler registration skipped:', e.message);
  }
}

registerRootComponent(App);
