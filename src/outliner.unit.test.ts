'use strict';

import { describe, it } from "mocha";
import * as util from "util";
import { expect } from "chai";
import * as outliner from './ginkgoOutliner';
import { GinkgoNode } from "./ginkgoNode";

// Sample output returned by `ginkgo outline`
// Keep in sync with https://github.com/onsi/ginkgo/tree/master/ginkgo/outline
const sampleOutput: string = `[{"name":"Describe","text":"NormalFixture","start":116,"end":605,"spec":false,"focused":false,"pending":false,"nodes":[{"name":"Describe","text":"normal","start":152,"end":244,"spec":false,"focused":false,"pending":false,"nodes":[{"name":"It","text":"normal","start":182,"end":240,"spec":true,"focused":false,"pending":false,"nodes":[{"name":"By","text":"step 1","start":207,"end":219,"spec":false,"focused":false,"pending":false,"nodes":[]},{"name":"By","text":"step 2","start":223,"end":235,"spec":false,"focused":false,"pending":false,"nodes":[]}]}]},{"name":"Context","text":"normal","start":247,"end":307,"spec":false,"focused":false,"pending":false,"nodes":[{"name":"It","text":"normal","start":276,"end":303,"spec":true,"focused":false,"pending":false,"nodes":[]}]},{"name":"When","text":"normal","start":310,"end":367,"spec":false,"focused":false,"pending":false,"nodes":[{"name":"It","text":"normal","start":336,"end":363,"spec":true,"focused":false,"pending":false,"nodes":[]}]},{"name":"It","text":"normal","start":370,"end":396,"spec":true,"focused":false,"pending":false,"nodes":[]},{"name":"Specify","text":"normal","start":399,"end":430,"spec":true,"focused":false,"pending":false,"nodes":[]},{"name":"Measure","text":"normal","start":433,"end":480,"spec":true,"focused":false,"pending":false,"nodes":[]},{"name":"DescribeTable","text":"normal","start":483,"end":541,"spec":false,"focused":false,"pending":false,"nodes":[{"name":"Entry","text":"normal","start":522,"end":537,"spec":true,"focused":false,"pending":false,"nodes":[]}]},{"name":"DescribeTable","text":"normal","start":544,"end":602,"spec":false,"focused":false,"pending":false,"nodes":[{"name":"Entry","text":"normal","start":583,"end":598,"spec":true,"focused":false,"pending":false,"nodes":[]}]}]}] `;

describe('outline.fromJSON', function () {
    it('should return an Outline with equivalent nested and flat representations', function () {
        const got = outliner.fromJSON(sampleOutput, 1);

        let i = 0;
        for (let n of got.nested) {
            outliner.preOrder(n, function (n: GinkgoNode) {
                expect(n).to.equal(got.flat[i], "nested node ${util.inspect(n, false, 1)} is not in flat");
                i++;
            });
        }
        expect(got.flat.length).to.equal(i, `flat has ${got.flat.length} nodes, but nested has ${i}`);
    });

    it('should return an Outline where every child node references its parent', function () {
        const got = outliner.fromJSON(sampleOutput, 1);

        for (let tn of got.nested) {
            for (let c of tn.nodes) {
                outliner.preOrder(c, function (n: GinkgoNode) {
                    expect(n.parent.nodes).includes(n, `node ${util.inspect(n, false, 1)} is not a child of its parent, ${util.inspect(n.parent, false, 1)}`);
                });
            }
        }
    });
});