import {describe,it,expect} from 'vitest';
import {resizedLength,describeLength,snapSize} from './canvasMeasurements';
describe('canvas measurements',()=>{
 it('retains relative units and distinguishes automatic sizing',()=>{
  expect(resizedLength(240,'80%',480)).toBe('50%');
  expect(resizedLength(32,'1rem',480,12,16)).toBe('2rem');
  expect(resizedLength(32,'1em',480,16)).toBe('2em');
  expect(resizedLength(180,undefined,480)).toBe('180px');
  expect(describeLength('50%')).toBe('50% · relativo');
  expect(describeLength('120px')).toBe('120px · fijo');
  expect(describeLength(undefined)).toBe('auto');
 });
 it('snaps only near a reference',()=>{
  expect(snapSize(238,[120,240,480],6)).toEqual({value:240,snapped:true});
  expect(snapSize(230,[120,240,480],6)).toEqual({value:230,snapped:false});
 });
});
