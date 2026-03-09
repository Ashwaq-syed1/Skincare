/**
 * @fileoverview Constants used in the app.
 */

import { environment } from '../environments/environment';

export const LABELS_BY_FILTER_VALUE = new Map([
  ['prefvegan', 'Vegan'],
  ['prefmineraloilfree', 'Without mineral oils'],
  ['prefparabenfree', 'Paraben-free'],
  ['prefworksforoilyskin', 'Works for oily skin'],
  ['prefcrueltyfree', 'Cruelty-free'],
  ['skincombination', 'Combination'],
  ['skindry', 'Dry'],
  ['skinnormal', 'Normal'],
  ['skinoily', 'Oily'],
  ['catecleansers', 'Cleansers'],
  ['cateeyecare', 'Eye Care'],
  ['cathightechtools', 'High Tech Tools'],
  ['catlipbalmtreatments', 'Lip Balms & Treatments'],
  ['catmasks', 'Masks'],
  ['catminisize', 'Mini Size'],
  ['catmoisturizers', 'Moisturizers'],
  ['catselftanners', 'Self Tanners'],
  ['catshopbyconcern', 'Shop by Concern'],
  ['catsunscreen', 'Sunscreen'],
  ['cattreatments', 'Treatments'],
  ['catvaluegiftsets', 'Value & Gift Sets'],
  ['catwellness', 'Wellness'],
  ['catother', 'Other'],
  ['price0to25', 'Less than $25'],
  ['price25to75', '$25 - $75'],
  ['price75to100', '$75 - $100'],
  ['price100to150', '$100 - $150'],
  ['price150to200', '$150 - $200'],
  ['price200to200plus', 'More than $200'],
  ['rating2to3', '2-3 Stars'],
  ['rating3to4', '3-4 Stars'],
  ['rating4to5plus', '4-5 Stars'],
]);

export const STATIC_FILE_PATH = environment.baseUrl;
