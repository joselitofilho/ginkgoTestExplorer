export interface JSONReportNodeLocation {
    FileName: string
    LineNumber: number    
}

export interface JSONSpecFailure {
    Message: string
    Location: JSONReportNodeLocation & {
        FullStackTrace: string
    }
}

export interface JSONSpecReport {
    State: 'passed' | 'skipped' | 'failed'
    // 'It', 'When', 'Describe' etc
    LeafNodeType: string
    // Label for the node (e.g. for It('something', func() { }) -> LeafNodeText == 'something')
    LeafNodeText: string
    LeafNodeLocation: JSONReportNodeLocation
    ContainerHierarchyTexts: string[] | null
    ContainerHierarchyLocations: JSONReportNodeLocation[] | null
    Failure?: JSONSpecFailure
}

export interface JSONSuiteReport {
    SuiteDescription: string
    SpecReports: JSONSpecReport[]
}

export type JSONReport = JSONSuiteReport[];