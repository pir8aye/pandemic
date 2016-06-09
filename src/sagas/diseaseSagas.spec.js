import { expect } from 'chai';
import { put, select, call } from 'redux-saga/effects';

import { epidemicIncrease, epidemicInfect, epidemicIntensify, discardBottomInfectionCard,
  discardTopInfectionCard } from '../actions/cardActions';
import { infectCities, initOutbreak, queueOutbreak, completeOutbreak, infectCity,
  useDiseaseCubes, eradicateDisease } from '../actions/diseaseActions';
import { yieldEpidemic, infectOrOutbreak, infections, yieldOutbreak, useCubes,
  checkForEradication } from './diseaseSagas';
import { yieldDefeat } from './globalSagas';
import * as sel from '../selectors';


describe('DiseaseSagas', function() {
  describe('yieldEpidemic', () => {
    beforeEach(() => {
      this.generator = yieldEpidemic();
      this.next = this.generator.next();
      expect(this.next.value).to.deep.equal(put(epidemicIncrease()));
      this.generator.next();
      this.generator.next('0');
      this.next = this.generator.next('blue');
      expect(this.next.value).to.deep.equal(select(sel.getDiseaseStatus, 'blue'));
    });

    it('skips infections for an eradicated disease', () => {
      this.next = this.generator.next('eradicated');
      expect(this.next.value).to.deep.equal(put(epidemicIntensify()));
      this.next = this.generator.next();
      expect(this.next.done).to.be.true;
    });

    it('runs infections for other disease statuses', () => {
      this.next = this.generator.next('cured');
      expect(this.next.value).to.deep.equal(put(epidemicInfect('0')));
      this.next = this.generator.next();
      expect(this.next.value).to.deep.equal(call(infectOrOutbreak, '0', 'blue', 3));
      this.next = this.generator.next();
      expect(this.next.value).to.deep.equal(put(discardBottomInfectionCard()));
      this.next = this.generator.next();
      expect(this.next.value).to.deep.equal(put(epidemicIntensify()));
      this.next = this.generator.next();
      expect(this.next.done).to.be.true;
    });
  });

  describe('infections', () => {
    beforeEach(() => {
      this.generator = infections();
      this.next = this.generator.next();
      expect(this.next.value).to.deep.equal(put(infectCities()));
      this.next = this.generator.next();
      expect(this.next.value).to.deep.equal(select(sel.getInfectionRate));
    });

    it('infects the number of cities equal to infection rate', () => {
      this.next = this.generator.next(2);
      for (let i = 0; i < 2; i++) {
        expect(this.next.value).to.deep.equal(select(sel.peekAtInfectionDeck));
        this.generator.next();
        this.generator.next();
        this.generator.next();
        this.generator.next();
        this.next = this.generator.next();
      }
      expect(this.next.done).to.be.true;
    });

    it('does not infect if the disease has been eradicated', () => {
      this.next = this.generator.next(1);
      expect(this.next.value).to.deep.equal(select(sel.peekAtInfectionDeck));
      this.generator.next('0');
      this.generator.next('blue');
      this.next = this.generator.next('eradicated');
      expect(this.next.value).to.deep.equal(put(discardTopInfectionCard()));
      this.next = this.generator.next();
      expect(this.next.done).to.be.true;
    });
  });

  describe('yieldOutbreak', () => {
    beforeEach(() => {
      this.generator = yieldOutbreak('0', 'blue');
      this.next = this.generator.next();
      expect(this.next.value).to.deep.equal(put(initOutbreak('0', 'blue')));
      this.next = this.generator.next();
      expect(this.next.value).to.deep.equal(select(sel.getNeighborCities, '0'));
    });

    it('queues an outbreak in a neighbor with 3 cubes', () => {
      this.next = this.generator.next([{ id: '0', name: 'London', color: 'red' }]);
      expect(this.next.value).to.deep.equal(select(sel.getCubesInCity, '0', 'blue'));
      this.generator.next(3);
      this.generator.next();
      this.next = this.generator.next();
      expect(this.next.value).to.deep.equal(put(queueOutbreak('0', 'blue')));
    });

    it('completes a single outbreak', () => {
      this.next = this.generator.next([{ id: '0', name: 'London', color: 'red' }]);
      expect(this.next.value).to.deep.equal(select(sel.getCubesInCity, '0', 'blue'));
      this.generator.next(1);
      this.generator.next();
      this.next = this.generator.next();
      expect(this.next.value).to.deep.equal(put(completeOutbreak('0', 'blue')));
      this.next = this.generator.next();
      expect(this.next.value).to.deep.equal(select(sel.getNextOutbreakCityId));
      this.next = this.generator.next(undefined);
      expect(this.next.done).to.be.true;
    });

    it('yields next outbreak in the queue', () => {
      this.next = this.generator.next([{ id: '0', name: 'London', color: 'red' }]);
      expect(this.next.value).to.deep.equal(select(sel.getCubesInCity, '0', 'blue'));
      this.generator.next(3);
      this.generator.next();
      this.next = this.generator.next();
      expect(this.next.value).to.deep.equal(put(queueOutbreak('0', 'blue')));
      this.next = this.generator.next();
      expect(this.next.value).to.deep.equal(put(completeOutbreak('0', 'blue')));
      this.next = this.generator.next();
      expect(this.next.value).to.deep.equal(select(sel.getNextOutbreakCityId));
      this.next = this.generator.next('1');
      expect(this.next.value).to.deep.equal(call(yieldOutbreak, '1', 'blue'));
      this.next = this.generator.next();
      expect(this.next.done).to.be.true;
    });
  });

  describe('infectOrOutbreak', () => {
    beforeEach(() => {
      this.generator = infectOrOutbreak('0', 'blue', 1);
      this.next = this.generator.next();
      expect(this.next.value).to.deep.equal(select(sel.getCubesInCity, '0', 'blue'));
    });

    it('yields outbreak if infected city is over 3 cubes', () => {
      this.next = this.generator.next(3);
      expect(this.next.value).to.deep.equal(call(useCubes, '0', 'blue', 1));
      this.next = this.generator.next();
      expect(this.next.value).to.deep.equal(put(infectCity('0', 'blue', 1)));
      this.next = this.generator.next();
      expect(this.next.value).to.deep.equal(call(yieldOutbreak, '0', 'blue'));
      this.next = this.generator.next();
      expect(this.next.done).to.be.true;
    });

    it('does not yield outbreak if infected city is under 3 cubes', () => {
      this.next = this.generator.next(2);
      expect(this.next.value).to.deep.equal(call(useCubes, '0', 'blue', 1));
      this.next = this.generator.next();
      expect(this.next.value).to.deep.equal(put(infectCity('0', 'blue', 1)));
      this.next = this.generator.next();
      expect(this.next.done).to.be.true;
    });
  });

  describe('useCubes', () => {
    beforeEach(() => {
      this.generator = useCubes('0', 'blue', 2);
      this.next = this.generator.next();
      expect(this.next.value).to.deep.equal(select(sel.getCubesInCity, '0', 'blue'));
    });

    it('adds the given number of cubes in full if possible', () => {
      this.next = this.generator.next(1);
      expect(this.next.value).to.deep.equal(select(sel.isOutOfCubes, 2, 'blue'));
    });

    it('adds only enough cubes to reach 3 if over limit', () => {
      this.next = this.generator.next(2);
      expect(this.next.value).to.deep.equal(select(sel.isOutOfCubes, 1, 'blue'));
    });

    it('yields defeat if there are not enough cubes', () => {
      this.generator.next(1);
      this.next = this.generator.next(true);
      expect(this.next.value).to.deep.equal(call(yieldDefeat));
    });

    it('does not yield defeat if there are enough cubes', () => {
      this.generator.next(1);
      this.next = this.generator.next(false);
      expect(this.next.value).to.deep.equal(put(useDiseaseCubes('blue', 2)));
    });
  });

  describe('checkForEradication', () => {
    beforeEach(() => {
      this.generator = checkForEradication({ color: 'blue' });
      this.next = this.generator.next();
      expect(this.next.value).to.deep.equal(select(sel.treatedAllOfColor, 'blue'));
    });

    it('does not eradicate if not all cubes have been treated', () => {
      this.next = this.generator.next(false);
      this.next = this.generator.next();
      expect(this.next.done).to.be.true;
    });

    it('does not eradicate if disease has not been cured', () => {
      this.next = this.generator.next(true);
      expect(this.next.value).to.deep.equal(select(sel.getDiseaseStatus, 'blue'));
      this.next = this.generator.next('active');
      expect(this.next.done).to.be.true;
    });

    it('eradicates if both conditions are satisfied', () => {
      this.next = this.generator.next(true);
      expect(this.next.value).to.deep.equal(select(sel.getDiseaseStatus, 'blue'));
      this.next = this.generator.next('cured');
      expect(this.next.value).to.deep.equal(put(eradicateDisease('blue')));
      this.next = this.generator.next();
      expect(this.next.value).to.be.done;
    });
  });
});
