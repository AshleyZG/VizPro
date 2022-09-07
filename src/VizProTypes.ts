
export interface Position{
    x: number,
    y: number,
}

export interface OverCodeCluster {
    id: number; // id of the cluster
    correct: boolean; // is the cluster correct?
    count: number; // how many solutions are in this cluster?
    members: string[]; // solutions in this cluster
    names: string[]; // student names
    positions?: Position[];
    events?: DLEvent[];
}


export interface DLEvent{
    id: string,
    code: string,
    passTest: boolean,
    target: string,
    timeOffset: number,
    type: string,
    x: number,
    y: number,
    cleanedCode: string,
    similarities: {[id: string]: number},
    edit_distances: {[id: string]: number},
    output?: string,
    clusterID?: number,
    hasFeedback? : boolean,
}

export interface MyNode{
    id: number,
    leftChild: MyNode | null,
    rightChild: MyNode | null,
    parent: MyNode | null,
    count: number,
    leafIDs: number[],
    x: number,
    y: number,
    radius: number,
    distance: number | null,
    code?: string,
}
