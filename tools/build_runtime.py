from pathlib import Path
import re
R=Path(__file__).resolve().parents[1];D=R/'development';A=R/'apps-script'
domain=(D/'domain.js').read_text();app=(D/'app.js').read_text()
(A/'Client.html').write_text('<script>\n'+domain+'\n'+app+'\n</script>\n')
(A/'Styles.html').write_text('<style>\n'+(D/'app.css').read_text()+'\n</style>\n')
(A/'Rules.gs').write_text(domain)
s=(A/'Code.gs').read_text();start=s.index('const NHETE_SERVER_RULES_');end=s.index('\n})();',start)+len('\n})();')
body=domain[domain.index("  'use strict';"):domain.index('  root.NheteRules = api;')]
s=s[:start]+'const NHETE_SERVER_RULES_ = (function () {\n'+body+'  return api;\n})();'+s[end:]
analysis=(D/'analysis.js').read_text()
body=analysis[analysis.index("  'use strict';"):analysis.index('  root.NheteAnalysis=api;')]
compiled='const NHETE_ANALYSIS_ = (function () {\n'+body+'  return api;\n})();'
if 'const NHETE_ANALYSIS_' in s:
 start=s.index('const NHETE_ANALYSIS_');end=s.index('\n})();',start)+len('\n})();');s=s[:start]+compiled+s[end:]
else:s+='\n'+compiled+'\n'
(A/'Code.gs').write_text(s)
print('Built Client.html, Styles.html, Rules.gs and embedded server rules')
