export type OntologyClass = {
  id: string; label: string; comments: string[]; completionRules: string[];
  attributes: { id: string; label: string; datatype: string }[];
  rules: string[]; checks: { label: string; text: string }[];
  business: {
    meaning: string; connections: string; attributes: string; states: string;
    earlyStates: string[][]; quantities: string[];
    roles: { role: string; meaning: string }[]; boundary: string;
  };
};
export type OntologyRelation = {
  id: string; label: string; from: string[]; to: string[]; inferred: boolean;
  meaning: string; quantity: string; boundary: string; proof: string[];
};
export type OntologyModel = {
  version: string; sha256: string; shapesSha256: string; businessSha256: string;
  classes: OntologyClass[]; relations: OntologyRelation[];
  completionPolicy: { label: string; text: string }[];
};
export type OntologyLink = OntologyRelation & { source: string; target: string };
