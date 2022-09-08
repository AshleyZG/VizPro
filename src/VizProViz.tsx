import React from 'react';
import * as d3 from 'd3';
import { scaleLinear, scaleSequential, scaleLog } from 'd3-scale';

import { DLEvent, Position, OverCodeCluster } from './VizProTypes';
import {levenshteinEditDistance} from 'levenshtein-edit-distance';


interface VizProVizProps {
    activeUsers: string[];
    events: {[name: string]: DLEvent[]};

    clusterIDs: number[];
    overCodeClusters: {[cluster_id: number]: OverCodeCluster};
    position: {[id: number]: Position};


    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
    radius: number;

    circleMouseOverFn: (clusterID: number, correctSolutions: string[], incorrectSolutions: string[], correctNames: string[], incorrectNames: string[])=>void;
    circleMouseOutFn: ()=>void;
    onBrushChangeFn: (events: DLEvent[])=>void;
};
interface VizProVizState {
};

class VizProViz extends React.Component<VizProVizProps, VizProVizState> {

    scalerX: d3.ScaleLinear<number, number, never>;
    scalerY: d3.ScaleLinear<number, number, never>;

    scalerColor: d3.ScaleSequential<string, never>;
    userCurrentEvent: {[name: string]: DLEvent} = {};
    paths: {[name: string]: d3.Path} = {};

    userCluster: {[name: string]: number} = {}; // if -1, not in any cluster, other wise, is in the cluster 
    clusterProgress: {[clusterID: number]: {correct: string[], incorrect: string[], names: string[]}} = {}
    userCorrectness: {[name: string]: boolean} = {};
    userCode: {[name: string]: string} = {};

    constructor(props: any){
        super(props);

        const WIDTH = this.props.width;
        const HEIGHT = this.props.height;

        this.scalerX = scaleLinear().domain([this.props.minX, this.props.maxX]).range([0, WIDTH]);
        this.scalerY = scaleLinear().domain([this.props.minY, this.props.maxY]).range([0, HEIGHT]);
        this.scalerColor = scaleSequential(d3.interpolateRdYlGn).domain([0, 1]);

        this.props.activeUsers.forEach((name: string, index: number) => {
            this.userCurrentEvent[name] = this.props.events[name][0];
            this.userCluster[name] = -1;
            this.userCorrectness[name] = false;
            this.paths[name] = d3.path();
            this.paths[name].moveTo(0, 0);
        })

        this.clusterProgress[-1] = {correct: [], incorrect: [], names: []};
        this.props.clusterIDs.forEach((id: number) => {
            this.clusterProgress[id] = {correct: [], incorrect: [], names: []};
        })

        this.setEventHappen();
        
    }

    setEventHappen(){
        var activeUsers = this.props.activeUsers;
        var events = this.props.events;

        const scope = this;

        const scalerTime = scaleLog()
            .domain([1, 46272942000])
            .range([0, 16*60*1000])

        activeUsers.forEach((name: string) => {
            events[name].forEach((event: DLEvent, index: number)=>{
                if (scalerTime(event.timeOffset+1) < 15*60*1000){
                    setTimeout(()=>{
                        var [x, y] = scope.calculatePos(name, event);
                        scope.userCode[name] = event.code;
                        // move path
                        scope.paths[name].lineTo(x, y);
                        
                        scope.updateGraph(name, x, y, event.passTest, event);
                    }, scalerTime(event.timeOffset+1));    
                }
            })
        })
    }

    dist(posA: Position, posB:Position){
        return (posA.x-posB.x)**2+(posA.y-posB.y)**2;
    }

    distToCluster(event: DLEvent, clusterID: number): number{
        var cluster = this.props.overCodeClusters[clusterID];
        var d = Infinity;
        for (var pos of cluster.positions!){
            var tempD = this.dist(pos, {x: event.x, y: event.y})
            if (tempD < d){
                d = tempD;
            }
        }
        return d;
    }

    editDistanceToCluster(event: DLEvent, clusterID: number): number{
        var cluster = this.props.overCodeClusters[clusterID];
        var d = Infinity;
        for (var e of cluster.events!){
            var editDist = this.editDistance(event.cleanedCode, e.cleanedCode);
            // console.log(editDist);
            if (editDist<d){
                d = editDist;
            }
        }
        return d;
    }

    calculateY(event: DLEvent, name: string){
        var clusterIDs = this.props.clusterIDs;
        const HEIGHT = this.props.height;

        if (event.type==='run' && event.passTest){
            if (event.clusterID){
                var y = HEIGHT / clusterIDs.length * (clusterIDs.indexOf(event.clusterID)+0.75)
                return [y, event.clusterID];
            }else{
                console.log('pass test but not have cluster id, need check here');
                return [0, 1];
            }
        }

        // find the position where it should be at
        var minDist = Infinity;
        var targetID = -1;
        for (var i of clusterIDs){
            var dist = this.distToCluster(event, i);
            if (dist < minDist){
                minDist = dist;
                targetID = i;
            }
        }
        var newClusterID = targetID;

        var y = HEIGHT/clusterIDs.length*(clusterIDs.indexOf(newClusterID)+0.75);
        return [y, newClusterID];
    }

    editDistance(code1: string, code2: string): number{
        return levenshteinEditDistance(code1, code2);
    }

    calculateX(event: DLEvent, newClusterID: number){  
        //   replace distance with edit distance
        const WIDTH = this.props.width;
        var scaler = scaleLinear().domain([0, WIDTH*0.3]).range([0, WIDTH*0.8]);

        if (event.type==='run' && event.passTest){
            if (event.clusterID){
                return WIDTH*0.8;
            }else{
                console.log('pass test but not have cluster id, need check here');
                return 0;
            }
        }
        var editDist = this.editDistanceToCluster(event, newClusterID);
        var x = WIDTH*0.8-scaler(editDist);
        return x;
    }

    calculatePos(name:string, event: DLEvent){

        // log previous cluster
        var prevClusterID = this.userCluster[name];

        // calculate y
        // here y means which solution it is most close to
        var [y, newClusterID] = this.calculateY(event, name);
        this.userCluster[name] = newClusterID;

        if (newClusterID>100){
            console.log(name, event);
        }
        // every time y updates, should update how many dots are in each cluster
        this.updateClusterProgress(name, prevClusterID, newClusterID, event.passTest);

        // calculate x
        // here x means how far away the dot is from coresponding solution
        var x = this.calculateX(event, newClusterID);

        return [x, y];
    }

    updateClusterProgress(name: string, prevClusterID: number, newClusterID: number, newCorrectness: boolean){
        // console.log(prevClusterID, newClusterID);
        if (prevClusterID!==-1){
            if(this.clusterProgress[prevClusterID].correct.includes(name)){
                // remove it from correct
                var index = this.clusterProgress[prevClusterID].correct.indexOf(name);
                this.clusterProgress[prevClusterID].correct.splice(index, 1);

            }else{
                // remove it from incorrect
                var index = this.clusterProgress[prevClusterID].incorrect.indexOf(name);

                this.clusterProgress[prevClusterID].incorrect.splice(index, 1)
            }
            var index = this.clusterProgress[prevClusterID].names.indexOf(name);
            this.clusterProgress[prevClusterID].names.splice(index, 1);
        }

        if (newCorrectness){
            this.clusterProgress[newClusterID].correct.push(name);
        }else{
            this.clusterProgress[newClusterID].incorrect.push(name);
        }
        this.clusterProgress[newClusterID].names.push(name);

        this.updateProgressGraph(prevClusterID, newClusterID);

    }

    private updateProgressGraph(prevClusterID: number, newClusterID: number){
        const graph = d3.select('.viz-canvas')
        const WIDTH = this.props.width;
        var scope = this;

        var wScale = scaleLinear().domain([0, 1]).range([0, WIDTH*0.1]);

        var progressBars = graph.selectAll('.progress-bar').filter(function(d, i){return d===prevClusterID || d===newClusterID});

        progressBars.selectAll('rect')
            .attr('width', function(d, i){return wScale(scope.clusterProgress[d as number].correct.length/(scope.clusterProgress[d as number].correct.length+scope.clusterProgress[d as number].incorrect.length+0.0001))})
            .attr('fill', 'green')
    }


    private updateGraph(name: string, x: number, y: number, passTest: boolean, event: DLEvent){
        const graph = d3.select('.viz-canvas');
        var scope = this;
        // update dot
        var dot = graph.selectAll('.current-dot').select(function(d, i){return d===name?  this : null}).select('circle');
        dot.transition()
            .duration(500)
            .attr('cx', x)
            .attr('cy', y)
            .attr('fill', passTest? 'green':'red');

        // update path
        var path = graph.selectAll('.trajectory').select(function(d, i){return d===name? this: null}).select('path');
        path.transition()
            .delay(500)
            .attr('d', function(d, i){return scope.paths[d as string].toString()});
        
        if (event.type==='run'){
            // add history dot
            var historyDots = graph.selectAll('.history-dot').select(function(d, i){return d===name? this: null});
            historyDots.append('circle')
                .datum(event)
                .attr('r', 2)
                .attr('cx', x)
                .attr('cy', y)
                .attr('fill', passTest? 'green':'red')
                .attr('opacity', '50%');

        }
    }

    updateBrush(scope: any, event: any){
        function isBrushed(extent: any, cx: string, cy: string): boolean{
            var x0 = extent[0][0],
                x1 = extent[1][0],
                y0 = extent[0][1],
                y1 = extent[1][1];
            var x = parseFloat(cx);
            var y = parseFloat(cy);

            return  x>=x0 && x<=x1 && y>=y0 && y<=y1;
        }

        const graph: d3.Selection<any, unknown, HTMLElement, any> = d3.select('.viz-canvas') 

        var extent = d3.brushSelection((graph.select('.brush') as any).node());
        var historyDots = graph.selectAll('.history-dot');

        if (extent){
            historyDots.selectAll('circle')
            .classed("selected", function(d){return isBrushed(extent!, d3.select(this).attr('cx'), d3.select(this).attr('cy')) && d3.select((this as any).parentNode).attr('visibility')!=='hidden'})
            scope.props.onBrushChangeFn(historyDots.selectAll('circle.selected').data() as DLEvent[])
        }
    }

    focusSolution(scope: any, clusterID: number){

        scope.resetGraph

        // get all names in this solution
        var names = scope.clusterProgress[clusterID].names;


        // get elements
        const graph = d3.select('.viz-canvas');
        var currentDots = graph.selectAll('.current-dot');
        var paths = graph.selectAll('.trajectory');
        var historyDots = graph.selectAll('.history-dot');

        // only show these names, hide others
        currentDots.filter(function(d, i){return !names.includes(d);})
            .attr('visibility', 'hidden');
        paths.filter(function(d, i){return !names.includes(d);})
            .attr('visibility', 'hidden');
        historyDots.filter(function(d, i){return !names.includes(d);})
            .attr('visibility', 'hidden');
    }

    resetGraph(event: any){
        // make all element visible
        const graph = d3.select('.viz-canvas');
        var outsideSolutionTag = graph.selectAll('.solution-tag').selectAll('text').filter(function(d, i){return this===event.target}).empty() 
        var outsideUserbox = d3.selectAll('.userbox').filter(function(d, i){return this===event.target.parentElement}).empty();

        if (outsideSolutionTag && outsideUserbox){
            var currentDots = graph.selectAll('.current-dot');
            var paths = graph.selectAll('.trajectory');
            var historyDots = graph.selectAll('.history-dot');
    
            // only show these names, hide others
            currentDots.attr('visibility', 'visible');
            paths.attr('visibility', 'visible');
            historyDots.attr('visibility', 'visible');    
        }

    }

    private initGroup(){

        var activeUsers = this.props.activeUsers;
        var clusterIDs = this.props.clusterIDs;
        var scope = this;

        const WIDTH = this.props.width;
        const HEIGHT = this.props.height;

        const graph: d3.Selection<any, unknown, HTMLElement, any> = d3.select('.viz-canvas') 
                        .attr('width', WIDTH)
                        .attr('height', HEIGHT);

        // add brush to svg
        graph.append('g')
            .attr('class', 'brush')
            .call(d3.brush<any>()
            .extent([[0, 0], [WIDTH*0.8, HEIGHT]])
            .on("start brush end", function(event){
                scope.updateBrush(scope, event);
            }), null
        )

        // draw init dots
        var dots = graph.selectAll('.current-dot')
            .data(activeUsers)
            .enter()
            .append('g')
            .attr('class', 'current-dot')
            .attr('id', function(d, i){return d});
        dots.append('circle')
            .attr('r', 2)
            .attr('cx', '0')
            .attr('cy', '0')
            .attr('fill', function(d, i){return 'red'})

        // add a path for each dot
        var paths = graph.selectAll('.trajectory')
            .data(activeUsers)
            .enter()
            .append('g')
            .attr('class', 'trajectory')
            .attr('id', function(d, i){return d});

        paths.append('path')
            .attr('d', function(d, i){return scope.paths[d].toString()})
            .style('stroke', 'gray')
            .style('stroke-width', '0.1')
            .style('stroke-opacity', '0.1')
            .style('fill', 'none');

        // add a group of history dots for each user
        graph.selectAll('.history-dot')
            .data(activeUsers)
            .enter()
            .append('g')
            .attr('class', 'history-dot')
            .attr('id', function(d,i){return d});


        // draw correct solution tags
        var tags = graph.selectAll('.solution-tag')
            .data(clusterIDs)
            .enter()
            .append('g')
            .attr('class', 'solution-tag')
            .attr('id', function(d, i){return d});
        tags.append('text')
            .text(function(d, i){return `Solution ${i}`})
            .attr('x', WIDTH*0.8)
            .attr('y', function(d, i){return HEIGHT/clusterIDs.length*(i+1)})
            .attr('fill', 'black')
            .on('mouseover', function(event, d){
                scope.props.circleMouseOverFn(d, scope.clusterProgress[d].correct.map((value: string)=>{return scope.userCode[value]}), scope.clusterProgress[d].incorrect.map((value: string)=>{return scope.userCode[value]}), scope.clusterProgress[d].correct, scope.clusterProgress[d].incorrect);
            })
            .on('click', function(event, d){
                scope.focusSolution(scope, d);
            })
        // append progress bar to tag
        var wScale = scaleLinear().domain([0, 1]).range([0, WIDTH*0.1]);
        var progressBars = graph.selectAll('.progress-bar')
            .data(clusterIDs)
            .enter()
            .append('g')
            .attr('class', 'progress-bar')
            .attr('id', function(d, i){return d});

        progressBars.append('rect')
            .attr('x', WIDTH*0.9)
            .attr('y', function(d, i){return HEIGHT/clusterIDs.length*(i+0.5)})
            .attr('width', function(d, i){return wScale(scope.clusterProgress[d].correct.length/(scope.clusterProgress[d].correct.length+scope.clusterProgress[d].incorrect.length+0.0001))})
            .attr('height', HEIGHT/clusterIDs.length*0.5)
            .attr('fill', 'green')

        d3.select('body').on('click', function(event, d){
            scope.resetGraph(event);
        })


    }

    componentDidMount(){
        this.initGroup();
    }


    render(): React.ReactNode {
        return <svg id='2d-viz-canvas' className='viz-canvas'>

        </svg>
    }
}

export {VizProViz};