"""Optional developer check. Requires lxml; no Python needed by EXE users.
Use --fetch once to obtain the official schemas; subsequent validation is offline.
"""
import argparse
import hashlib
import json
from pathlib import Path
import urllib.request
from zipfile import ZipFile
from lxml import etree

ROOT = Path(__file__).resolve().parents[1]
SCHEMAS = ROOT / 'tests' / 'schemas'
URLS = {
    'ogckml22.xsd': 'https://schemas.opengis.net/kml/2.2.0/ogckml22.xsd',
    'atom-author-link.xsd': 'https://schemas.opengis.net/kml/2.2.0/atom-author-link.xsd',
    'xAL.xsd': 'https://docs.oasis-open.org/election/external/xAL.xsd',
}
parser = argparse.ArgumentParser()
parser.add_argument('kmz', type=Path)
parser.add_argument('--fetch', action='store_true')
args = parser.parse_args()
if args.fetch:
    SCHEMAS.mkdir(parents=True, exist_ok=True)
    manifest = []
    for name, url in URLS.items():
        with urllib.request.urlopen(url, timeout=20) as response:
            data = response.read()
        etree.fromstring(data)
        (SCHEMAS / name).write_bytes(data)
        manifest.append({'file': name, 'url': url, 'sha256': hashlib.sha256(data).hexdigest(), 'retrievedAt': '2026-11-02'})
    (SCHEMAS / 'sources.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')

class LocalResolver(etree.Resolver):
    def resolve(self, url, public_id, context):
        name = url.rsplit('/', 1)[-1]
        if name in URLS:
            return self.resolve_filename(str(SCHEMAS / name), context)
        return None

xml_parser = etree.XMLParser(resolve_entities=False, no_network=True)
xml_parser.resolvers.add(LocalResolver())
schema = etree.XMLSchema(etree.parse(str(SCHEMAS / 'ogckml22.xsd'), xml_parser))
with ZipFile(args.kmz) as archive:
    kml = etree.fromstring(archive.read('doc.kml'), xml_parser)
    schema.assertValid(kml)
    dae = etree.fromstring(archive.read('models/turbine.dae'), xml_parser)
    ns = {'c': 'http://www.collada.org/2005/11/COLLADASchema'}
    ids = set(dae.xpath('//@id'))
    for ref in dae.xpath('//@source | //@url | //@target'):
        if ref.startswith('#'):
            assert ref[1:] in ids, ref
    triangles = sum(int(t.get('count')) for t in dae.xpath('//c:triangles', namespaces=ns))
    assert triangles <= 15000
    assert dae.get('version') == '1.4.1'
    assert dae.find('c:asset/c:up_axis', ns).text == 'Z_UP'
print(json.dumps({'kmlXsd': 'passed', 'daeXmlAndReferences': 'passed', 'daeFullXsd': 'not run', 'triangles': triangles}))
