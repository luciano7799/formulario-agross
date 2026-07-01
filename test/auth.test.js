const { test } = require('node:test');
const assert = require('node:assert');
const { gerenteTemFilial } = require('../auth');

test('retorna true quando a filial está vinculada ao gerente', () => {
  assert.strictEqual(gerenteTemFilial({ filiais: ['Lins', 'Paulínia'] }, 'Lins'), true);
});

test('retorna false quando a filial não está vinculada', () => {
  assert.strictEqual(gerenteTemFilial({ filiais: ['Lins'] }, 'Anápolis'), false);
});

test('retorna false quando o gerente não tem filiais', () => {
  assert.strictEqual(gerenteTemFilial({ filiais: [] }, 'Lins'), false);
});

test('retorna false quando o gerente é nulo ou inválido', () => {
  assert.strictEqual(gerenteTemFilial(null, 'Lins'), false);
  assert.strictEqual(gerenteTemFilial({}, 'Lins'), false);
});
