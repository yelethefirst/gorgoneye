import type { RuleSignal } from "../shared/verdict";
import type { ParsedUrl } from "../shared/parsedUrl";
import type { RuleId } from "./weights";

export interface Rule {
  id: RuleId;
  name: string;
  defaultWeight: number;
  evaluate(parsed: ParsedUrl): RuleSignal;
}
