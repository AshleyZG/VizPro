import {
    JupyterFrontEnd,
    ILayoutRestorer,
    JupyterFrontEndPlugin
  } from '@jupyterlab/application';

import { DocumentRegistry } from '@jupyterlab/docregistry';
import {
    NotebookPanel,
    INotebookModel,
  } from '@jupyterlab/notebook';
import { DisposableDelegate, IDisposable } from '@lumino/disposable';
import {
    ICommandPalette,
  } from '@jupyterlab/apputils';
// import { ICurrentUser } from '@jupyterlab/user';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';

import { ToolbarButton } from '@jupyterlab/apputils';
import { OverCodeModel, OverCodeWidget } from './OverCodeWidget';
import { DLEvent } from './VizProTypes';

var allEvents: any = {};

fetch('https://raw.githubusercontent.com/AshleyZG/VizProData/master/url-list-session2.json')
    .then((response) => response.json())
    .then((responseJson) => {
        responseJson.forEach((url: string) => {
            fetch(url)
                .then((response) => response.json())
                .then((content) => {
                    var key = content[0]['sid']+'.json';
                    allEvents[key] = content;
                })
                .catch((error)=>{
                    console.log(error);
                })
        })
    })
    .then(()=>{
        console.log(allEvents);
    })
    .catch((error) => {
        console.error(error);
    })



class ButtonExtension implements DocumentRegistry.IWidgetExtension<NotebookPanel, INotebookModel>{
    createNew(widget: NotebookPanel, context: DocumentRegistry.IContext<INotebookModel>): void | IDisposable {

        function callback(){
            var events: {[name: string]: DLEvent[]} = allEvents;

            const keySolutionWidgetMap = new Map<string, OverCodeWidget>();
    
            widget.content.widgets.forEach((cell, index) => {

                var solutionViewModel = new OverCodeModel(events);
                var solutionViewWidget = new OverCodeWidget(solutionViewModel);

                keySolutionWidgetMap.set(cell.model.metadata.get('cellID') as string, solutionViewWidget);

                (cell.layout as any).addWidget(solutionViewWidget);
            })
 
            const keyCellMap = new Map<string, number>();

            widget.content.widgets.forEach((cell, index) => {
                keyCellMap.set(cell.model.metadata.get('cellID') as string, index);
            })

        }
        const button = new ToolbarButton({
            className: 'vizpro-button',
            label: 'OverCode',
            onClick: callback,
            tooltip: `OverCode`
        });

        widget.toolbar.insertItem(17, 'overcodebutton', button);
        return new DisposableDelegate(() => {
            button.dispose();
          });
    }
}

const pluginOverCode: JupyterFrontEndPlugin<void> = {
    id: 'VizPro:overcode-plugin',
    autoStart: true,
    requires: [ICommandPalette, IRenderMimeRegistry, ILayoutRestorer],
    activate: activatePlugin
}
  


function activatePlugin(
    app: JupyterFrontEnd,
    palette: ICommandPalette,
    rendermime: IRenderMimeRegistry,
    restorer: ILayoutRestorer    
): void {
    
    app.docRegistry.addWidgetExtension('Notebook', new ButtonExtension());

}
  
export default pluginOverCode;