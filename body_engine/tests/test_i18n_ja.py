"""Japanese language selection, catalog safety and intentional English fallback (no database)."""
import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest

from body_engine import i18n
from test_i18n import ZH, EN, EN_TEXT, PH

STATIC = Path(__file__).resolve().parents[1] / "src/body_engine/web/static"


def japanese_catalog():
    entries = {}
    for line in (STATIC / "i18n-ja.js").read_text(encoding="utf-8").splitlines():
        if not line.lstrip().startswith('"'):
            continue
        key, value = json.loads("{" + line.strip().rstrip(",") + "}").popitem()
        assert key not in entries, key
        entries[key] = value
    return entries


def test_japanese_core_and_placeholders():
    entries = japanese_catalog()
    assert set(ZH) <= set(entries), "All shell, profile and elder-view keys need Japanese"
    assert set(entries) <= set(ZH) | set(EN_TEXT), "Unknown or obsolete Japanese keys"
    for key, value in entries.items():
        assert value.strip(), key
        assert set(PH.findall(ZH.get(key, key))) == set(PH.findall(value)), key
    sw = (STATIC / "sw.js").read_text(encoding="utf-8")
    assert '"i18n-ja.js"' in sw
    for name in ("activate.html", "install.html", "oauth.html"):
        html = (STATIC / name).read_text(encoding="utf-8")
        assert html.index('src="i18n.js"') < html.index('src="i18n-en.js"') < html.index('src="i18n-ja.js"')


def test_request_language_and_bilingual_server_fallback():
    assert i18n.norm("ja-JP") == "ja"
    with i18n.use_lang("ja"):
        assert i18n.lang() == "ja"
        assert i18n.L("中文", "English") == "English"
        assert i18n.tl("示例", {"示例": "Example"}) == "Example"
        with i18n.use_lang("zh"):
            assert i18n.L("中文", "English") == "中文"
        assert i18n.lang() == "ja"
    assert i18n.lang() == "zh"


HARNESS = r"""
const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const base = process.argv[1], store = {};
const document = { documentElement: {dataset: {},lang:''}, title:'', querySelectorAll:()=>[], querySelector:()=>null };
const context = {document, navigator:{language:'ja-JP',languages:['ja-JP']}, location:{hash:'',pathname:'/app/',search:''},
  history:{replaceState:()=>{}}, localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=v},removeItem:k=>{delete store[k]}}};
context.window=context;vm.createContext(context);
for (const file of ['i18n.js','i18n-en.js','i18n-ja.js']) vm.runInContext(fs.readFileSync(base+'/'+file,'utf8'),context);
const i=context.I18N;
assert.equal(i.lang,'ja');assert.equal(document.documentElement.lang,'ja');assert.equal(i.locale(),'ja-JP');
assert.equal(i.t('tab.today'),'今日');assert.equal(i.t('elder.readPage'),'読み上げ');
assert.equal(i.t('恢复分 {v}',{v:42}),'回復スコア 42');
for(const [k,v] of Object.entries(i.enText)) if(!(k in i.tables.ja)) assert.equal(i.t(k),v);
assert.equal(i.setPref('en'),true);assert.equal(i.t('tab.today'),'Today');
assert.equal(i.setPref('zh'),true);assert.equal(i.t('tab.today'),'今天');
assert.equal(i.choose('ja'),true);assert.equal(i.unsaved(),'ja');assert.equal(i.headers()['X-Body-Lang'],'ja');
i.markSaved();assert.equal(i.unsaved(),null);
assert.equal(i.setPref(null),false);assert.equal(i.lang,'ja');
console.log('Japanese, Chinese, English, placeholders and fallback: PASS');
"""


@pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
def test_web_japanese_switch_and_english_fallback():
    out = subprocess.run(["node", "-e", HARNESS, str(STATIC)], capture_output=True, text=True, check=True)
    assert "PASS" in out.stdout
