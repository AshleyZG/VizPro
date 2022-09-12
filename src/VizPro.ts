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
import { VizProModel, VizProWidget } from './VizProWidget';
import { DLEvent } from './VizProTypes';

var allEvents: any = {};

fetch('https://raw.githubusercontent.com/AshleyZG/VizProData/master/url-list-session2.json')
    .then((response) => response.json())
    .then((responseJson) => {
        responseJson.forEach((url: string) => {
            fetch(url)
                .then((response) => response.json())
                .then((content) => {
                    var key = content[0]['sid'];
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
            console.log(events);

            const keySolutionWidgetMap = new Map<string, VizProWidget>();
    
            widget.content.widgets.forEach((cell, index) => {

                var solutionViewModel = new VizProModel(events);
                var solutionViewWidget = new VizProWidget(solutionViewModel);

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
            label: 'VizPro',
            onClick: callback,
            tooltip: `VizPro`
        });

        widget.toolbar.insertItem(15, 'vizprobutton', button);
        return new DisposableDelegate(() => {
            button.dispose();
          });
    }
}


class ExampleButtonExtension implements DocumentRegistry.IWidgetExtension<NotebookPanel, INotebookModel>{
    createNew(widget: NotebookPanel, context: DocumentRegistry.IContext<INotebookModel>): void | IDisposable {

        function callback(){
            var events: {[name: string]: DLEvent[]} = {};
            var i = 0;
            for (let key in allEvents){
                i+=1;
                events[key] = allEvents[key];
                if (i==20){
                    break;
                }
            }
            const keySolutionWidgetMap = new Map<string, VizProWidget>();
    
            widget.content.widgets.forEach((cell, index) => {

                var solutionViewModel = new VizProModel(events);
                var solutionViewWidget = new VizProWidget(solutionViewModel);

                keySolutionWidgetMap.set(cell.model.metadata.get('cellID') as string, solutionViewWidget);

                (cell.layout as any).addWidget(solutionViewWidget);
            })
 
            const keyCellMap = new Map<string, number>();

            widget.content.widgets.forEach((cell, index) => {
                keyCellMap.set(cell.model.metadata.get('cellID') as string, index);
            })

        }
        const button = new ToolbarButton({
            className: 'vizpro-example-button',
            label: 'Example',
            onClick: callback,
            tooltip: `VizPro Example`
        });

        widget.toolbar.insertItem(16, 'vizproexamplebutton', button);
        return new DisposableDelegate(() => {
            button.dispose();
          });
    }
}

const pluginVizPro: JupyterFrontEndPlugin<void> = {
    id: 'VizPro:vizpro-plugin',
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
    app.docRegistry.addWidgetExtension('Notebook', new ExampleButtonExtension());

}
  
export default pluginVizPro;