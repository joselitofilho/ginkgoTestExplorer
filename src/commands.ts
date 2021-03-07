'use strict';

import { EventEmitter, Event } from "vscode";
import { GinkgoNode } from "./ginkgoNode";
import { TestResult } from "./testResult";

export class Commands {

    private readonly onTestDiscoveryFinishedEmitter = new EventEmitter<GinkgoNode[]>();
    private readonly onTestRunStartedEmitter = new EventEmitter<GinkgoNode>();
    private readonly onTestResultsEmitter = new EventEmitter<TestResult[]>();
    private readonly onCheckGinkgoIsInstalledEmitter = new EventEmitter<void>();

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
    public get testResults(): Event<TestResult[]> {
        return this.onTestResultsEmitter.event;
    }
    public sendTestResults(testResults: TestResult[]) {
        this.onTestResultsEmitter.fire(testResults);
    }
    public get checkGinkgoIsInstalledEmitter(): Event<void> {
        return this.onCheckGinkgoIsInstalledEmitter.event;
    }
    public sendCheckGinkgoIsInstalledEmitter() {
        this.onCheckGinkgoIsInstalledEmitter.fire();
    }
}