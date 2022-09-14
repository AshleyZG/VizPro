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
    userEvent: {[name: string]: DLEvent} = {};

    constructor(props: any){
        super(props);

        const WIDTH = this.props.width;
        const HEIGHT = this.props.height;

        this.scalerX = scaleLinear().domain([this.props.minX, this.props.maxX]).range([0, WIDTH*0.8]);
        this.scalerY = scaleLinear().domain([this.props.minY, this.props.maxY]).range([0, HEIGHT]);
        this.scalerColor = scaleSequential(d3.interpolateRdYlGn).domain([0, 1]);

        this.props.activeUsers.forEach((name: string, index: number) => {
            this.userCurrentEvent[name] = this.props.events[name][0];
            this.userCluster[name] = -1;
            this.userCorrectness[name] = false;
            this.paths[name] = d3.path();
            this.paths[name].moveTo(0, HEIGHT);
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
            .domain([1, 7208569070+5])
            .range([0, 15*60*1000])

        activeUsers.forEach((name: string) => {
            events[name].forEach((event: DLEvent, index: number)=>{
                setTimeout(()=>{
                    var [x, y] = scope.calculatePos(name, event);
                    scope.userCode[name] = event.code;
                    scope.userEvent[name] = event;
                    // move path
                    scope.paths[name].lineTo(x, y);
                    
                    scope.updateGraph(name, x, y, event.passTest, event);
                }, scalerTime(event.timeOffset+1));    

            })
        })
    }

    dist(posA: Position, posB:Position){
        return Math.abs(posA.y-posB.y);
        // return (posA.x-posB.x)**2+(posA.y-posB.y)**2;
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

        if (event.clusterID && event.passTest){
            // console.log(event.clusterID)
            return [this.scalerY(this.props.position[event.clusterID].y), event.clusterID];
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

        var y = this.scalerY(event.y);
        return [y, newClusterID];
    }

    editDistance(code1: string, code2: string): number{
        return levenshteinEditDistance(code1, code2);
    }

    calculateX(event: DLEvent){  
        const WIDTH = this.props.width;

        if (event.type==='run' && event.passTest){
            return WIDTH*0.8;
        }

        return this.scalerX(event.x);
    }

    calculatePos(name:string, event: DLEvent){
        var prevClusterID = this.userCluster[name];
        var x = this.calculateX(event);
        // var y = this.scalerY(event.y);
        var [y, newClusterID] = this.calculateY(event, name);
        this.userCluster[name] = newClusterID;
        this.updateClusterProgress(name, prevClusterID, newClusterID, event.passTest);
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
            .attr('fill', passTest? 'blue':'orange');

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
                .attr('r', 2.5)
                .attr('cx', x)
                .attr('cy', y)
                .attr('fill', 'grey')
                .attr('opacity', '50%');

        }

        // var correctSize = graph.selectAll('.current-dot').select(function(d, i){return d===name?  this : null}).select('circle').filter(function(d, i){return d3.select(this).attr('fill')==='green'}).size();
        // var incorrectSize = graph.selectAll('.current-dot').select(function(d, i){return d===name?  this : null}).select('circle').filter(function(d, i){return d3.select(this).attr('fill')==='red'}).size();
        // graph.select('.stats').select('text').text(`${correctSize} Correct Submissions, ${incorrectSize} Incorrect Submissions`)
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

        if (!extent){return;}
        var historyDots = graph.selectAll('.history-dot');
        var currentDots = graph.selectAll('.current-dot');

        currentDots.selectAll('circle')
            .classed("selected", function(d){
                return isBrushed(extent!, d3.select(this).attr('cx'), d3.select(this).attr('cy')) && d3.select((this as any).parentNode).attr('visibility')!=='hidden'})

        historyDots.selectAll('circle')
            .classed("selected", function(d){return isBrushed(extent!, d3.select(this).attr('cx'), d3.select(this).attr('cy')) && d3.select((this as any).parentNode).attr('visibility')!=='hidden'})
        
        scope.props.onBrushChangeFn(((currentDots.selectAll('circle.selected').data() as string[]).map((d: string) => {return scope.userEvent[d]})).concat(historyDots.selectAll('circle.selected').data() as DLEvent[]))

    }

    focusSolution(scope: any, clusterID: number){

        // scope.resetGraph

        // get all names in this solution
        var names = scope.clusterProgress[clusterID].names;


        // get elements
        const graph = d3.select('.viz-canvas');
        var currentDots = graph.selectAll('.current-dot');
        var paths = graph.selectAll('.trajectory');
        var historyDots = graph.selectAll('.history-dot');

        // reset graph first

        currentDots.attr('visibility', 'visible');
        paths.attr('visibility', 'visible');
        historyDots.attr('visibility', 'visible');    

        paths.selectAll('path')
            .style('stroke-width', '0.1')
            .style('stroke-opacity', '0.1')


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
        var outsideSolutionTag = graph.selectAll('.solution-tag').selectAll('rect').filter(function(d, i){return this===event.target}).empty() 
        var outsideUserbox = d3.selectAll('.userbox').filter(function(d, i){return this===event.target.parentElement}).empty();
        var outsideButton = d3.select('.button').selectAll('text').filter(function(d, i){return this===event.target}).empty()

        if (outsideSolutionTag && outsideUserbox && outsideButton){
            var currentDots = graph.selectAll('.current-dot');
            var paths = graph.selectAll('.trajectory');
            var historyDots = graph.selectAll('.history-dot');
    
            currentDots.attr('visibility', 'visible');
            paths.attr('visibility', 'visible');
            historyDots.attr('visibility', 'visible');    

            paths.selectAll('path')
                .style('stroke-width', '0.1')
                .style('stroke-opacity', '0.1')
        }

    }

    switchHistoryVisible(event: any){
        var target = event.target; 

        var content = d3.select(target).text();

        const graph: d3.Selection<any, unknown, HTMLElement, any> = d3.select('.viz-canvas') 

        if (content.startsWith('Hide')){
            d3.select(target).text('Show History Versions');
            // hide history dots
            var paths = graph.selectAll('.trajectory');
            var historyDots = graph.selectAll('.history-dot');
            paths.attr('visibility', 'hidden');
            historyDots.attr('visibility', 'hidden');    


        }else{
            d3.select(target).text( 'Hide History Versions');
            // show history dots
            var paths = graph.selectAll('.trajectory');
            var historyDots = graph.selectAll('.history-dot');
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

        // add a group of history dots for each user
        graph.selectAll('.history-dot')
            .data(activeUsers)
            .enter()
            .append('g')
            .attr('class', 'history-dot')
            .attr('id', function(d,i){return d});

        // draw init dots
        var dots = graph.selectAll('.current-dot')
            .data(activeUsers)
            .enter()
            .append('g')
            .attr('class', 'current-dot')
            .attr('id', function(d, i){return d});
        dots.append('circle')
            .attr('r', 5)
            .attr('cx', '0')
            .attr('cy', HEIGHT)
            .attr('fill', function(d, i){return 'orange'})

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



        // add y axis
        // const yaxis = d3.path();
        // yaxis.moveTo(WIDTH*0.8+5, 0);
        // yaxis.lineTo(WIDTH*0.8, HEIGHT);

        // graph.append('g')
        //     .attr('class', 'yaxis')
        //     .append('path')
        //     .attr('stroke', 'black')
        //     .attr('stroke-width', 1)
        //     .attr('d', yaxis.toString());
            
        // var tagScaler = scaleLinear().domain()
        var tagOffsets: {[key: number]: number} = {5: 20, 2: 20, 16:40, 6: 60, 26: 80, 28: 20, 13: 20, 27:40, 21:20, 9:20};
        // draw correct solution tags
        var tags = graph.selectAll('.solution-tag')
            .data(clusterIDs)
            .enter()
            .append('g')
            .attr('class', 'solution-tag')
            .attr('id', function(d, i){return d});
        tags.append('text')
            .text(function(d, i){return d})
            .attr('x', function(d, i){ return WIDTH*0.8+5+(d in tagOffsets? tagOffsets[d]: 0)})
            .attr('y', function(d, i){return scope.scalerY(scope.props.position[d].y)+8})
        tags.append('rect')
            .attr('width', 20)
            .attr('height', 10)
            .attr('x', function(d, i){ return WIDTH*0.8+5+(d in tagOffsets? tagOffsets[d]: 0)})
            .attr('y', function(d, i){return scope.scalerY(scope.props.position[d].y)})
            .attr('rx', 2)
            .attr('fill', 'gray')
            .attr('opacity', '50%')
            .on('mouseover', function(event, d){
                scope.props.circleMouseOverFn(d, scope.clusterProgress[d].correct.map((value: string)=>{return scope.userCode[value]}), scope.clusterProgress[d].incorrect.map((value: string)=>{return scope.userCode[value]}), scope.clusterProgress[d].correct, scope.clusterProgress[d].incorrect);
            })
            .on('click', function(event, d){
                scope.focusSolution(scope, d);
            })
            
        // append progress bar to tag
        // var wScale = scaleLinear().domain([0, 1]).range([0, WIDTH*0.1]);


        // add brush to svg
        graph.append('g')
            .attr('class', 'brush')
            .call(d3.brush<any>()
            .extent([[0, 0], [WIDTH*0.8, HEIGHT]])
            .on("start brush end", function(event){
                scope.updateBrush(scope, event);
            }), null
        )

        
        // add button to hide all history versions
        var button = graph.append('g')
            .attr('class', 'button')
            .attr('id', 'button')

        button.append('rect')
            .attr('fill', 'gainsboro')
            .attr('width', 150)
            .attr('height', 25)
            .attr('rx', 10)
            .attr('x', 0)
            .attr('y', 0)
        button.append('text')
            .attr('x', 10)
            .attr('y', 20)
            .text('Hide History Versions')
            .on('click', function(event, d){
                scope.switchHistoryVisible(event);
            })

        var button2 = graph.append('g')
            .attr('class', 'button')
            .attr('id', 'button')

        button2.append('rect')
            .attr('fill', 'gainsboro')
            .attr('width', 75)
            .attr('height', 25)
            .attr('rx', 10)
            .attr('x', 0)
            .attr('y', 30)
        button2.append('text')
            .attr('x', 10)
            .attr('y', 50)
            .text('Reset Map')
            .on('click', function(event, d){
                scope.resetGraph(event);
            })



        // d3.select('body').on('click', function(event, d){
        //     scope.resetGraph(event);
        // })


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