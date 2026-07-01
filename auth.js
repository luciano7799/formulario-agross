function gerenteTemFilial(gerente, filial) {
  return !!gerente && Array.isArray(gerente.filiais) && gerente.filiais.includes(filial);
}

module.exports = { gerenteTemFilial };
