// Mock API base URL - replace with production URL when ready
// Current: Mock environment
// Production: Replace the entire base URL below
// export const API_BASE_URL = 'http://127.0.0.1:4523/m1/4283432-3925564-default';
export const API_BASE_URL = 'http://20.198.22.11:8050';

// API endpoints
export const API_ENDPOINTS = {
    // Trace system API - retrieves system and trade codes
    traceSystem: (traceId: string) => `${API_BASE_URL}/mview/traceApi/trace/system?traceId=${traceId}`,
    // Topology API - retrieves service chain topology
    traceTopology: (traceId: string, systemCode: string) => `${API_BASE_URL}/mview/traceApi/trace/topoloy/all?traceId=${traceId}&systemCode=${systemCode}`,
    // Node detail API - retrieves input/output and status for a specific node
    traceNodeApp: (appName: string, traceId: string, traceCode: string, nodeId: string) =>
        `${API_BASE_URL}/mview/traceApi/trace/tags/app?appName=${appName}&traceId=${traceId}&traceCode=${traceCode}&nodeId=${nodeId}`,
};


// API response interfaces
export interface TraceSystemResponse {
    code: number;
    data: {
        systemCode: string;
        tradeCode: string;
        errorStatement: number;
        startTime: string;
    };
    message: string;
    success: boolean;
}

export interface TopologyTag {
    key: string;
    value: string;
}

export interface TopologyNode {
    startTime: number;
    endTime: number;
    traceId: string;
    nodeId: string;
    parentNodeId: string;
    serviceCode: string;
    tags: TopologyTag[];
    errorStatement: boolean;
    endpointName: string;
}

export interface TopologyResponse {
    success: boolean;
    message: string;
    retCode: string | null;
    data: TopologyNode[];
}

// Node detail types
export interface ServiceIO {
    input: string;
    output: string;
}

export interface RootCauseAnalysis {
    responseCode: string;
    responseMessage: string;
    exceptionStack: string | null;
}

export interface NodeDetailData {
    serviceIOList: ServiceIO[];
    rootCauseAnalysisList: RootCauseAnalysis[];
    executeSqlList: any[];
    startTime: number;
    endTime: number;
}

export interface NodeDetailResponse {
    success: boolean;
    message: string;
    retCode: string | null;
    data: NodeDetailData[];
}
