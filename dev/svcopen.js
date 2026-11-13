/* тесты: раскрывать свёрнутый блок «Служебное» (#sySvc) сразу после его появления */
module.exports = function () {
  var f = function () {
    var run = function () { var d = document.getElementById('sySvc'); if (d && !d.open && !d.__o) { d.__o = 1; d.open = true; } };
    new MutationObserver(run).observe(document, { childList: true, subtree: true });
  };
  return '(' + f.toString() + ')()';
};
