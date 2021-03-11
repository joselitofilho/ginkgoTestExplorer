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

export function isRootNode(node: GinkgoNode): boolean {
    return node.parent === undefined && node.nodes.length > 0 && !isWrenchNode(node);
}

export function isRunnableTest(node: GinkgoNode): boolean {
    return node.name !== 'By' && !node.pending && !isWrenchNode(node);
}

export function isSuiteTest(node: GinkgoNode): boolean {
    switch (node.name) {
        case 'Context':
        case 'FContext':
        case 'PContext':
        case 'XContext':
        case 'Describe':
        case 'FDescribe':
        case 'PDescribe':
        case 'XDescribe':
        case 'When':
        case 'FWhen':
        case 'PWhen':
        case 'XWhen':
            return true;
    }
    return false;
}

export function isWrenchNode(node: GinkgoNode): boolean {
    switch (node.name) {
        case 'BeforeEach':
        case 'AfterEach':
        case 'JustBeforeEach':
        case 'JustAfterEach':
        case 'BeforeSuite':
        case 'AfterSuite':
            return true;
    }
    return false;
}