import { formatMoney, scaleAmount, type Industry, type Market } from '../lib/presets';
import type { Brand } from '../lib/settings';
import { agentScenarios, networkScenarios, reviewScenarios } from './other';
import { extraScenarios } from './extra';
import { protectScenarios } from './protect';
import { signupScenarios } from './signup';
import type { Journey, Scenario, ScenarioContext } from './types';

export * from './types';

export function makeContext(m: Market, ind: Industry, brand: Brand): ScenarioContext {
  return {
    m, ind, brand,
    amt: (base) => scaleAmount(base, m),
    exact: (base) => Math.round(base * m.scale * 100) / 100,
    money: (base) => formatMoney(scaleAmount(base, m), m),
  };
}

export function allScenarios(c: ScenarioContext): Scenario[] {
  return [
    ...signupScenarios(c),
    ...extraScenarios(c),
    ...protectScenarios(c),
    ...agentScenarios(c),
    ...networkScenarios(c),
    ...reviewScenarios(c),
  ];
}

/** Scenarios with this industry's leads first, the rest in their natural order. */
export function orderedFor(c: ScenarioContext): Scenario[] {
  const all = allScenarios(c);
  const lead = c.ind.leads;
  const rank = (s: Scenario) => {
    const i = lead.indexOf(s.id);
    return i === -1 ? lead.length + all.indexOf(s) : i;
  };
  return [...all].sort((a, b) => rank(a) - rank(b));
}

export const JOURNEYS: Journey[] = ['signup', 'protect', 'agents', 'network', 'review'];

export function findScenario(c: ScenarioContext, id: string): Scenario | undefined {
  return allScenarios(c).find((s) => s.id === id);
}
