import { VDomRenderer, VDomModel, UseSignal } from '@jupyterlab/apputils';
import React from 'react';
// import { CodeBlock } from "react-code-blocks";
import { scaleLog } from 'd3-scale';

// import * as d3 from 'd3';

// import SyntaxHighlighter from 'react-syntax-highlighter';
// import { VizProViz } from './VizProViz';
import { DLEvent, Position, MyNode, OverCodeCluster } from './VizProTypes';
var overcode_result: any;

fetch('https://raw.githubusercontent.com/AshleyZG/VizProData/master/ac6_8_9_all_solutions.json')
    .then((response) => response.json())
    .then((responseJson) => {
        overcode_result = responseJson;
        console.log(overcode_result)
    })
    .catch((error) => {
        console.error(error);
    })

class OverCodeModel extends VDomModel {

    activeUsers: string[] = [];

    events: {[name: string]: DLEvent[]} = {};

    currentCode: {[name: string]: string} = {};

    submissions: {[name: string]: DLEvent[]} = {};
    
    currentIncorrectSolutions: {[name: string]: DLEvent | null} = {};

    userClusterID: {[name: string]: number | null} = {};
    clusterCount: {[id: number]: number} = {};
    clusterNames: {[id: number]: string[]} = {};


    // currentClusterNumber: {[id: number]: DLEvent[]} = {};

    selectedCommit: {[name: string]: string | null} = {};
    selectedOutput: {[name: string]: string | null} = {};
    selectedPassTest: {[name: string]: boolean | null} = {};

    treeNodes: {[key: number]: MyNode} = {};
    rootNode: MyNode | undefined;
    leafEvents: {[key: number]: DLEvent} = {};

    overCodeCandidates: {[name: string]: string[]} = {};
    overCodeResults: {[key:string]: number} = {};
    rawOverCodeResults: any[] = [];
    clusterIDs: number[] = [];
    overCodeClusters: {[cluster_id: number]: OverCodeCluster} = {};
    position: {[id: number]: Position} = {};

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
        this.events = events;
        // this.activeUsers = Object.keys(events);


        this.rawOverCodeResults = overcode_result;

        for (const cluster of overcode_result){
            var cluster_id = cluster.id;
            for (const member of cluster.members){
                this.overCodeResults[member] = cluster_id;
            }
        }

        this.loadEvents(events);


        this.setEventHappen();

    }

    setEventHappen(){
        var scope = this;

        const scalerTime = scaleLog()
        // .domain([1, 46272942000])
        .domain([1, 7208569070+5])
        .range([0, 0.5*60*1000])
        var MAX = -Infinity;
        this.activeUsers.forEach((name: string) => {
            this.events[name].forEach((event: DLEvent, index: number) => {
                setTimeout(() => {
                    scope.currentCode[name] = event.code;
                    if (event.type==='start'){
                        scope.submissions[name] = [];
                        scope.selectedCommit[name] = null;
                        scope.selectedOutput[name] = null;
                        scope.selectedPassTest[name] = null;
                        scope.userClusterID[name] = null;
                        scope.currentIncorrectSolutions[name] = null;
                    }
                    if (event.type==='run'){
    

                        scope.submissions[name].push(event);
                        if (scope.userClusterID[name]){
                            scope.clusterCount[scope.userClusterID[name]!]-=1;
                        }
                        if (event.clusterID && event.passTest){
                            scope.userClusterID[name] = event.clusterID;
                            scope.clusterCount[scope.userClusterID[name]!]+=1;
                            scope.currentIncorrectSolutions[name] = null;
                        }else{
                            scope.userClusterID[name] = null;
                            scope.currentIncorrectSolutions[name] = event;
                        }

                        if (name.startsWith('user_150')){
                            console.log(event);
                            console.log(this.currentIncorrectSolutions[name]);
                        }

                    }
                    if (event.type==='edit'){
                        if (scope.userClusterID[name]){
                            scope.clusterCount[scope.userClusterID[name]!]-=1;
                        }
                        scope.userClusterID[name] = null;
                    }
                    scope.stateChanged.emit();
                }, scalerTime(event.timeOffset+1));

            })
        })
        console.log(MAX);
        return;
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
        }
        this.nSample = n_samples;

        // sort clusters by edit dist
        this.sortClusterIDs();
        this.stateChanged.emit();
    }

    sortClusterIDs(){

        function dist(posA: Position, posB:Position){
            return (posA.x-posB.x)**2+(posA.y-posB.y)**2;
        }

        // find largest cluster id
        var maxN = -Infinity;
        var maxID = -1;
        this.clusterIDs.forEach((id: number) => {
            if (this.overCodeClusters[id].count > maxN){
                maxID = id;
                maxN = this.overCodeClusters[id].count;
            }
        })

        var position: {[id: number]: Position} = {};
        this.clusterIDs.forEach((id: number) => {
            position[id] =  this.averagePosition(this.overCodeClusters[id].positions!)
        })
        this.position = position;
        // sort 2d array
        // directly sort this.clusterIDs
        this.clusterIDs.sort((a, b)=>{
            var positionA = position[a];
            var positionB = position[b];
            return dist(positionA, position[maxID]) - dist(positionB, position[maxID]);
        });
    }
    averagePosition(positions: Position[]){
        var l = positions.length;
        var sumX = positions.reduce((a, b) => {return a+b.x}, 0);
        var sumY = positions.reduce((a, b) => {return a+b.y}, 0);
        var averagePosition: Position = {x: sumX/l, y: sumY/l};
        return averagePosition;
    }

    updateOverCodeResults(name: string, event: DLEvent){

        var idx = this.overCodeCandidates[name].length-1;
        var new_name = name.split('@')[0];
        var key = new_name+'_'+idx;
        var key = event.id;
        if (!(key in this.overCodeResults)){
            return;
        }
        var cluster_id = this.overCodeResults[key];

        // if (['19114', '7071'].includes(event.id)){
        //     cluster_id = 12;
        // }

        event.clusterID = cluster_id;

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
            this.clusterCount[cluster_id] = 0;
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

    solutionTagOnClick(){
        var scope = this;
        function fn(event: React.MouseEvent){
            var clusterID = parseInt(event.currentTarget.getAttribute('data-clusterID')!);
            scope.activeUsers.forEach((name: string) => {
                if (clusterID===scope.userClusterID[name]){
                    console.log(name);
                }
            })
            // console.log()
            return;
        }
        return fn;
    }

    onMouseClickCommit(){
        var scope = this;
        function fn(event: React.MouseEvent){
            var name = event.currentTarget.getAttribute('data-name')!;
            var code = event.currentTarget.getAttribute('data-code');
            var output = event.currentTarget.getAttribute('data-output');
            var passTest = event.currentTarget.getAttribute('data-passTest');
            
            scope.selectedCommit[name] = code;
            scope.selectedOutput[name] = output;
            scope.selectedPassTest[name] = passTest==='true';

            scope.stateChanged.emit();
            return;
        }
        return fn;
    }

    onMouseClickRecover(){
        var scope = this;
        function fn(event: React.MouseEvent){
            var name = event.currentTarget.getAttribute('data-name')!;
            scope.selectedCommit[name] = null;
            scope.selectedOutput[name] = null;
            scope.selectedPassTest[name] = null;
            scope.stateChanged.emit();
            return;
        }
        return fn;
    } 

}


class OverCodeWidget extends VDomRenderer<OverCodeModel> {

    ref: SVGSVGElement|undefined;

    constructor(model: OverCodeModel) {
        super(model);
    }

    
    render(): any {
        return <div> 
            <UseSignal signal={this.model.stateChanged} >
                {(): any => {
                    return <div>
                    <div className='overcode-left-panel'>
                        {this.model.activeUsers.map((name: string) => {
                            return <div>
                                <p><span className='name'>{name}</span></p>
                                <div className='commit-bar'>
                                    {name in this.model.submissions ? this.model.submissions[name].map((event: DLEvent) => {
                                        return <div className='commit-unit' data-name={name} data-code={event.code} data-output={event.output} data-passTest={event.passTest}  onMouseOver={this.model.onMouseClickCommit()} ></div>
                                    }): null}
                                    <div className='recover-unit' data-name={name} onMouseOver={this.model.onMouseClickRecover()}></div>
                                </div>

                                {/* error message */}
                                {(name in this.model.selectedOutput && this.model.selectedOutput[name])? <p>{this.model.selectedOutput[name]}</p>: null}
                                {(name in this.model.selectedPassTest && this.model.selectedPassTest[name]!==null)? <p>{this.model.selectedPassTest[name]? '': 'Not'} Pass Test Case</p>: null}
                                {/* commit messages */}
                                {/* <p><span>Commit</span></p> */}

                                {/* code block */}
                                <div className='codeblock'>
                                    <p>
                                    {(name in this.model.selectedCommit && this.model.selectedCommit[name])? this.model.selectedCommit[name]!: this.model.currentCode[name]}
                                    </p>
                                </div>

                            </div>
                        })}
                    </div>
                    <div className='overcode-right-panel'>
                        {/* <p>{} submissions in total</p> */}
                        {this.model.clusterIDs.map((clusterID:number, index: number) => {
                            return this.model.clusterCount[clusterID]>0? 
                             <div className='overcode-block'>
                                <p className='name' data-clusterID={clusterID} onClick={this.model.solutionTagOnClick()}>Solution {index}, {
                                this.model.clusterCount[clusterID]
                                } submissions</p>
                                <div>
                                    {this.model.activeUsers.filter((name: string) => {
                                        return this.model.userClusterID[name]===clusterID;
                                    }).map((name: string) => {
                                        return <div className='userbox'>
                                            <span>{name.split('@')[0]}</span>
                                        </div>
                                    })}
                                </div>
                                <div className='codeblock'>
                                    <p>
                                    {this.model.overCodeClusters[clusterID].members[0]}
                                    </p>
                                </div>
                                
                            </div> : null
                            })}
                        {this.model.activeUsers.map((name: string) => {
                            return this.model.currentIncorrectSolutions[name]? 
                            
                            <div className='overcode-block'>
                            <p >{name}</p>
                            <div className='codeblock incorrect'>
                                <p>
                                {this.model.currentIncorrectSolutions[name]?.code}
                                </p>
                            </div>

                            </div> : null


                        })}
                    </div>
                    </div>
                }}
            </UseSignal>
        </div> 
    }
}

export {OverCodeWidget, OverCodeModel};