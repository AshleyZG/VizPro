import { VDomRenderer, VDomModel, UseSignal } from '@jupyterlab/apputils';
import React from 'react';
import * as d3 from 'd3';

import SyntaxHighlighter from 'react-syntax-highlighter';
import { VizProViz } from './VizProViz';
import { DLEvent, Position, MyNode, OverCodeCluster } from './VizProTypes';
// import { active } from 'd3';
var overcode_result: any;

fetch('https://raw.githubusercontent.com/AshleyZG/VizProData/master/ac6_8_9_last_solution.json')
    .then((response) => response.json())
    .then((responseJson) => {
        overcode_result = responseJson;
        console.log(overcode_result);
        // overcode_result=[];
    })
    .catch((error) => {
        console.error(error);
    })

class VizProModel extends VDomModel {

    activeUsers: string[] = [];
    currentPosition: {[name: string]: Position} = {};
    events: {[name: string]: DLEvent[]} = {};
    treeNodes: {[key: number]: MyNode} = {};
    rootNode: MyNode | undefined;
    leafEvents: {[key: number]: DLEvent} = {};

    overCodeCandidates: {[name: string]: string[]} = {};
    overCodeResults: {[key:string]: number} = {};
    rawOverCodeResults: any[] = [];
    clusterIDs: number[] = [];
    overCodeClusters: {[cluster_id: number]: OverCodeCluster} = {};
    position: {[id: number]: Position} = {};
    currentCode: {[name: string]: string} = {};
    selectedClusterID: number | undefined;
    selectedCorrectSolutions: string[] | undefined;
    selectedIncorrectSolutions: string[] | undefined;
    selectedCorrectNames: string[] | undefined;
    selectedIncorrectNames: string[] | undefined;

    feedback: string | undefined;
    searchUser: string | undefined;

    groupError: boolean = false;

    nSample: number | undefined;
    minX: number = Infinity;
    minY: number = Infinity;
    maxX: number = -Infinity;
    maxY: number = -Infinity;

    selectedEvents: DLEvent[] = [];

    constructor(events: {[name: string]: DLEvent[]}){
        super();
        this.rawOverCodeResults = overcode_result;

        for (const cluster of overcode_result){
            var cluster_id = cluster.id;
            for (const member of cluster.members){
                this.overCodeResults[member] = cluster_id;
            }
        }

        this.loadEvents(events);

    }


    updateOverCodeResults(name: string, event: DLEvent){

        var idx = this.overCodeCandidates[name].length-1;
        var new_name = name.split('@')[0];
        var key = new_name+'_'+idx;
        var key = event.id;
        if (! (key in this.overCodeResults)){
            return;
        }
        var cluster_id = this.overCodeResults[key];

        if (['19114', '7071'].includes(event.id)){
            cluster_id = 12;
        }

        event.clusterID = cluster_id;
        console.log(event.clusterID);
        if (this.rawOverCodeResults[cluster_id-1].correct && !(this.clusterIDs.includes(cluster_id))){
            this.clusterIDs.push(cluster_id);
        }


        if (this.rawOverCodeResults[cluster_id-1].correct && ! (cluster_id in this.overCodeClusters)){
            this.overCodeClusters[cluster_id] = {
                id: cluster_id,
                correct: this.rawOverCodeResults[cluster_id-1].correct,
                count: 0,
                members: [],
                names: [],
                positions: [],
                events: [],
            }
        }

        if (this.rawOverCodeResults[cluster_id-1].correct){
            this.overCodeClusters[cluster_id].members.push(this.overCodeCandidates[name][idx]);
            this.overCodeClusters[cluster_id].names.push(name);
            this.overCodeClusters[cluster_id].positions?.push({x: event.x, y: event.y});
            this.overCodeClusters[cluster_id].events?.push(event);
            this.overCodeClusters[cluster_id].count+=1;    
        }
  
        if (this.rawOverCodeResults[cluster_id-1].correct){
            return cluster_id;
        }else{
            return null;
        }
    }

    averagePosition(positions: Position[]){
        var l = positions.length;
        var sumX = positions.reduce((a, b) => {return a+b.x}, 0);
        var sumY = positions.reduce((a, b) => {return a+b.y}, 0);
        var averagePosition: Position = {x: sumX/l, y: sumY/l};
        return averagePosition;
    }

    sortClusterIDs(){

        var position: {[id: number]: Position} = {};
        this.clusterIDs.forEach((id: number) => {
            position[id] =  this.averagePosition(this.overCodeClusters[id].positions!)
        })
        this.position = position;
        // sort 2d array
        // directly sort this.clusterIDs
        this.clusterIDs.sort((a, b)=>{
            var positionA = position[a].y;
            var positionB = position[b].y;
            return positionA-positionB;
        });
    }

    loadEvents(events: {[name: string]: DLEvent[]}){
        // init variables
        var n_samples = 0;

        // set events
        this.events = events;

        // set minX, minY, maxX, maxY, nSample
        for (let name in events){
            events[name].forEach((event: DLEvent, index: number) => {
                this.minX = event.x<this.minX? event.x : this.minX;
                this.minY = event.y<this.minY? event.y : this.minY;
                this.maxX = event.x>this.maxX? event.x : this.maxX;
                this.maxY = event.y>this.maxY? event.y : this.maxY;
                n_samples += 1;

                if (event.type==='run' && event.output==='success'){

                    // get overcode cluster id
                    if (! (name in this.overCodeCandidates)){
                        this.overCodeCandidates[name] = [];
                    }

                    this.overCodeCandidates[name].push(event.code);
                    this.updateOverCodeResults(name, event);

                }

            })
            this.activeUsers.push(name);
            this.currentCode[name] = '';
        }
        this.nSample = n_samples;
        this.activeUsers = ['user_120@umich.edu', 'user_127@umich.edu', 'user_20@umich.edu'];
        // sort clusters by edit dist
        this.sortClusterIDs();
        this.stateChanged.emit();
    }

    circleMouseOver(){
        const scope = this;
        function fn(clusterID: number, correctSolutions: string[], incorrectSolutions: string[], correctNames: string[], incorrectNames: string[]){
            scope.selectedClusterID = clusterID;
            scope.selectedCorrectSolutions = correctSolutions;
            scope.selectedIncorrectSolutions = incorrectSolutions;

            scope.selectedCorrectNames = correctNames;
            scope.selectedIncorrectNames = incorrectNames;
            scope.stateChanged.emit();
        }
        return fn;
    }


    circleMouseOut(){
        const scope = this;
        function fn(){
            scope.stateChanged.emit();
        }
        return fn;
    }

    onBrushChange(){
        const scope = this;
        function fn(events: DLEvent[]){
            // scope.selectedEvents = events.filter((value: DLEvent) => {return value.type==='run'});
            scope.selectedEvents = events;
            scope.feedback = "";
            scope.groupError = true;
            scope.stateChanged.emit();
        }
        return fn;
    }

    focusOnUser(scope: any, name: string){
        scope.groupError = false;

        // update right panel - selected solutions are user's commits
        const graph = d3.select('.viz-canvas');
        var currentDots = graph.selectAll('.current-dot');
        var paths = graph.selectAll('.trajectory');
        var historyDots = graph.selectAll('.history-dot');

        currentDots.attr('visibility', 'visible');
        paths.attr('visibility', 'visible');
        historyDots.attr('visibility', 'visible');    

        paths.selectAll('path')
            .style('stroke-width', '0.1')
            .style('stroke-opacity', '0.1')


        currentDots.filter(function(d, i){return d!==name;})
            .attr('visibility', 'hidden');
        paths.filter(function(d, i){return d!==name;})
            .attr('visibility', 'hidden');
        paths.filter(function(d, i){return d===name;})
            .selectAll('path')
            .style('stroke-opacity', '1')
            .style('stroke-width', '0.5')
        historyDots.filter(function(d, i){return d!==name;})
            .attr('visibility', 'hidden');

        // focus on user
        // only show events that have happened
        var count = historyDots.select(function(d, i){return d===name? this: null})
            .selectAll('circle')
            .size()
        
        scope.selectedEvents = scope.events[name].filter((e: DLEvent) => {return e.type==='run';}).slice(0, count);
        scope.feedback = "";

    }

    userOnClick(){
        const scope = this;
        function fn(event: React.MouseEvent){
            // console.log(d3.selectAll('.userbox').size());
            d3.selectAll('.userbox')
                .classed('selected', false);
            var target = event.currentTarget;
            target.classList.add('selected');
            scope.focusOnUser(scope, target.id);
            scope.stateChanged.emit();

        }
        return fn;
    }


    searchUserSubmit(){
        var scope = this;
        function fn(event:  React.FormEvent<HTMLFormElement>){
            // debugger;
            if (!scope.searchUser){
                event.preventDefault();
                return;}
            if (!(scope.activeUsers.includes(scope.searchUser!+'@umich.edu'))){
                event.preventDefault();
                return;}
            if (scope.searchUser?.startsWith('user_')){
                scope.focusOnUser(scope, scope.searchUser!+'@umich.edu');
                scope.searchUser = "";
                event.preventDefault();
                scope.stateChanged.emit();    
            }
        }
        return fn;
    }

    searchUserChange(){
        var scope = this;
        function fn(event: React.FormEvent<HTMLInputElement>){
            scope.searchUser = event.currentTarget.value;
            scope.stateChanged.emit();
        }
        return fn;
    }

    feedbackSubmit(){
        var scope = this;
        function fn(event:  React.FormEvent<HTMLFormElement>){
            scope.selectedEvents.forEach((e: DLEvent) => {
                e.hasFeedback = true;
            })
            event.preventDefault();
            scope.stateChanged.emit();
        }
        return fn;
    }

    feedbackChange(){
        var scope = this;
        function fn(event: React.FormEvent<HTMLInputElement>){
            scope.feedback = event.currentTarget.value;
            scope.stateChanged.emit();
        }
        return fn;
    }

    updateCode(){
        var scope = this;
        function fn(name: string, event: DLEvent){
            var code = (event.code.split('\n').filter((l: string) => {return (!l.startsWith('assert') && !l.startsWith('del'))})).join('\n');
            scope.currentCode[name] = code;
            scope.stateChanged.emit();
        }
        return fn;
    }

}


class VizProWidget extends VDomRenderer<VizProModel> {

    ref: SVGSVGElement|undefined;

    constructor(model: VizProModel) {
        super(model);
    }

    renderEventList(groupError: boolean){
        if (groupError){
            var errorTypes: string[] = [];
            var groups: {[error: string]: DLEvent[]} = {};
            var correctEvents: DLEvent[] = [];
            var activeEvents: DLEvent[] = [];
            this.model.selectedEvents.forEach((event: DLEvent, index: number) => {
                if (event.type!=='run'){
                    activeEvents.push(event);
                }
                else if (event.passTest){
                    correctEvents.push(event);
                }else{
                    var error = event.output!.split(':')[0];
                    error = error==='success'? 'Failed the test case': error;
                    if (!errorTypes.includes(error)){
                        errorTypes.push(error);
                        groups[error] = [];
                    }
                    groups[error].push(event);
                }
            })
            return <div> 
                {errorTypes.map((error: string) => {
                    return <div>
                        <span className='error-type'>{error} {groups[error].length} submissions</span>
                        {groups[error].map((e: DLEvent) => {
                            return <div>
                                <span>{e.output==='success'? error: e.output} {e.sid.split('@')[0]}</span>
                                <SyntaxHighlighter 
                                language='python'
                                showLineNumbers={true}
                                wrapLines={true}
                                customStyle={{
                                    backgroundColor: e.passTest? "gainsboro": "rgb(255, 214, 139)",
                                    opacity: e.hasFeedback? "50%": "100%",
                                }}
                                lineProps={(lineNumber: number): React.HTMLProps<HTMLElement> => {
                                    const style: React.CSSProperties = {display: "block", width: "100%"};
                                    if (e.output!.match(/\d+/g)?.includes(lineNumber.toString())){
                                        style.backgroundColor="orange";
                                    }
                                    return {style};
                                }}
                                >{e.code}</SyntaxHighlighter> 
                            </div>
        
                        })}
                    </div>
                })}
                {correctEvents.map((event: DLEvent) => {
                    return <div>
                        <SyntaxHighlighter 
                        language='python'
                        >{event.code}</SyntaxHighlighter> 
                    </div>
                })}
                {activeEvents.length>0? <span className='error-type'>Typing on it</span>: null}
                {activeEvents.map((event: DLEvent) => {
                    return <div>
                        <SyntaxHighlighter 
                        language='python'
                        customStyle={{
                            backgroundColor: event.passTest? "gainsboro": "rgb(255, 214, 139)",
                        }}

                        >
                            {event.code}
                        </SyntaxHighlighter>
                    </div>
                })}
            </div>
        }else{
            return <div>
            {this.model.selectedEvents.map((event: DLEvent, index: number) => {
                return <div>
                    {event.passTest? null: <span>{event.output==='success'? 'Failed the test case': event.output}</span>}
                    <SyntaxHighlighter 
                    language='python'
                    showLineNumbers={true}
                    wrapLines={true}
                    customStyle={{
                        backgroundColor: event.passTest? "gainsboro": "rgb(255, 214, 139)",
                        opacity: event.hasFeedback? "50%": "100%",
                    }}
                    lineProps={(lineNumber: number): React.HTMLProps<HTMLElement> => {
                        const style: React.CSSProperties = {display: "block", width: "100%"};
                        if (event.output!.match(/\d+/g)?.includes(lineNumber.toString())){
                            style.backgroundColor="orange";
                        }
                        return {style};
                    }}
                    >{event.code}</SyntaxHighlighter> 

                </div>
            })}

            </div>

        }
    }

    render(): any {
        return <div> 
            <UseSignal signal={this.model.stateChanged} >
                {(): any => {

                    var colorMap: {[key: string]: string} = {'user_120@umich.edu': '#D2691E',
                    'user_127@umich.edu': '#8A2BE2',
                    'user_20@umich.edu': '#1E90FF'}
                    var nameMap: {[key: string]: string} = {'user_120@umich.edu': 'A',
                    'user_127@umich.edu': 'B',
                    'user_20@umich.edu': 'C'}
                    // const style={
                    //     border-style: 'solit',
                    //     border
                    // }

                    return <div>
                        <div className='scatter-left-view'>
                            {/* scatter widget */}
                            <VizProViz
                                activeUsers={this.model.activeUsers}
                                events={this.model.events}
                            
                                clusterIDs={this.model.clusterIDs}
                                overCodeClusters={this.model.overCodeClusters}
                                position={this.model.position}
                            
                                minX={this.model.minX}
                                minY={this.model.minY}
                                maxX={this.model.maxX}
                                maxY={this.model.maxY}
                                width={1000}
                                height={800}
                                radius={8}
                            
                                circleMouseOverFn={this.model.circleMouseOver()}
                                circleMouseOutFn={this.model.circleMouseOut()}
                                onBrushChangeFn={this.model.onBrushChange()}
                                updateCode={this.model.updateCode()}
                            ></VizProViz>
                        </div>
                        <div className='scatter-right-view'>
                            {this.model.activeUsers.map((name: string) => {
                                return <div style={{border: `2px solid ${colorMap[name]}`, margin:'5px'}}>
                                    <span>{nameMap[name]}</span>
                                    <SyntaxHighlighter language='python'
                                    >{this.model.currentCode[name]}

                                    </SyntaxHighlighter>
                                </div>
                                
                            })}
                        </div>
                    </div>
                }}
            </UseSignal>
        </div> 
    }
}

export {VizProWidget, VizProModel};