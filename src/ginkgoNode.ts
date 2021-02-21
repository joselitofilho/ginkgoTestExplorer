import { TestResult } from "./testResult";

export interface GinkgoNode {
    // Metadata
    // Keep in sync with https://github.com/onsi/ginkgo/tree/master/ginkgo/outline
    key: string;
    name: string;
    text: string;
    start: number;
    end: number;
    spec: boolean;
    pending: boolean;
    focused: boolean;
    running: boolean;

    result?: TestResult;

    nodes: GinkgoNode[];
    parent: GinkgoNode;
}

export function isRunnableTest(node: GinkgoNode): boolean {
    return node.name !== 'By' && !node.pending;
}