import { request, unwrap } from './requestClient';
import { arrayContract, objectContract } from './responseContract';
import type { OntologyClass, OntologyModel, OntologyRelation } from '../modules/business-ontology/types';
const textArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string');
const businessContract = objectContract<OntologyClass['business']>(['meaning', 'connections', 'attributes', 'states', 'earlyStates', 'quantities', 'roles', 'boundary'], {
  quantities: textArray, roles: arrayContract(objectContract(['role', 'meaning'])),
  earlyStates: (value: unknown): value is string[][] => Array.isArray(value) && value.every(textArray)
});
const classContract = objectContract<OntologyClass>(['id', 'label', 'comments', 'attributes', 'rules', 'checks', 'business'], {
  business: businessContract, comments: textArray, rules: textArray,
  attributes: arrayContract(objectContract(['id', 'label', 'datatype'])), checks: arrayContract(objectContract(['label', 'text']))
});
const relationContract = objectContract<OntologyRelation>(['id', 'label', 'from', 'to', 'inferred', 'meaning', 'quantity', 'boundary', 'proof'], {
  from: textArray, to: textArray, proof: textArray, inferred: (value: unknown): value is boolean => typeof value === 'boolean'
});
const modelContract = objectContract<OntologyModel>(['version', 'sha256', 'shapesSha256', 'businessSha256', 'classes', 'relations'], {
  classes: arrayContract(classContract), relations: arrayContract(relationContract)
});
export function getBusinessOntology(signal?: AbortSignal) {
  return unwrap(request.get('/business-ontology', { signal }), modelContract);
}
