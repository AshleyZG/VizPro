import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import pluginVizPro from './VizPro';
import pluginOverCode from './OverCode';

/**
 * Initialization data for the VizPro extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'VizPro:plugin',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    console.log('JupyterLab extension VizPro is activated!');
  }
};

// export default plugin;
export default [plugin, pluginVizPro, pluginOverCode];
