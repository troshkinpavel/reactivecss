// Components available in every MDX article, and the HTML element mapping.
import CodeBlock from '~/components/code/CodeBlock.astro';
import { AdvancedIndex } from '~/components/docs/AdvancedIndex';
import { Callout } from '~/components/docs/Callout';
import { Card, Cards, Fact, Facts, Flow, FlowStep } from '~/components/docs/Facts';
import { BundleIntro, Disclosure, Faq, FaqItem, FeatureList, Lead, QuickStart, QuickStep, SizeBars } from '~/components/docs/CustomBundles';
import ApiIndex from './ApiIndex.astro';
import Code from './Code.astro';
import CodePair from './CodePair.astro';
import Compare from './Compare.astro';
import Example from './Example.astro';
import ExampleIndex from './ExampleIndex.astro';
import H2 from './H2.astro';
import H3 from './H3.astro';
import Li from './Li.astro';

import NotShipped from './NotShipped.astro';
import EngineeringReport from './EngineeringReport.astro';
import Bundles from './Bundles.astro';
import NpmState from './NpmState.astro';
import Ol from './Ol.astro';
import P from './P.astro';
import Related from './Related.astro';
import Strong from './Strong.astro';
import Table from './Table.astro';
import Ul from './Ul.astro';

export const mdxComponents = {
  CodeBlock, CodePair, Example, Compare, Callout, Facts, Fact, Flow, FlowStep, Cards, Card, Related, ApiIndex, ExampleIndex, AdvancedIndex, NotShipped, EngineeringReport, Bundles, NpmState,
  BundleIntro, Disclosure, Faq, FaqItem, FeatureList, Lead, QuickStart, QuickStep, SizeBars,
  h2: H2, h3: H3, p: P, ul: Ul, ol: Ol, li: Li, strong: Strong, table: Table, code: Code,
};
