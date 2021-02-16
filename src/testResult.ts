export class TestResult {

    constructor(
        public suiteName: string,
        public testName: string,
        public isPassed: boolean,
        public output?: string,
        public error?: Error
    ) { }

}