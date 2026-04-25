// index.js
import { registerRootComponent } from 'expo';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import App from './App';
import { widgetTaskHandler } from './widgets/widgetTaskHandler';

// MUST be called before registerRootComponent
registerWidgetTaskHandler(widgetTaskHandler);

registerRootComponent(App);
