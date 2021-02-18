import { EventEmitter, Event } from "vscode";
import { GinkgoNode } from "./outliner";
import { TestResult } from "./testResult";

export class Commands {

    private readonly onTestDiscoveryFinishedEmitter = new EventEmitter<GinkgoNode[]>();
    private readonly onTestRunStartedEmitter = new EventEmitter<GinkgoNode>();
    private readonly onTestResultEmitter = new EventEmitter<TestResult[]>();

    public get discoveredTest(): Event<GinkgoNode[]> {
        return this.onTestDiscoveryFinishedEmitter.event;
    }
    public sendDiscoveredTests(testNodeList: GinkgoNode[]) {
        this.onTestDiscoveryFinishedEmitter.fire(testNodeList);
    }
    public get testRunStarted(): Event<GinkgoNode> {
        return this.onTestRunStartedEmitter.event;
    }
    public sendTestRunStarted(testNode: GinkgoNode) {
        this.onTestRunStartedEmitter.fire(testNode);
    }
    public get testResult(): Event<TestResult[]> {
        return this.onTestResultEmitter.event;
    }
    public sendTestResult(testResults: TestResult[]) {
        this.onTestResultEmitter.fire(testResults);
    }
}