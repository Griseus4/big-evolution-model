import test from 'node:test';
import {TEMPORAL_CHECKS} from '../dist/temporal-checks.js';
for(const c of TEMPORAL_CHECKS)test(c.label,c.run);
