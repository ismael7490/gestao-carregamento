import re,os,shutil
src=open('/home/claude/ordens/index.html').read()
shim=open('/home/claude/standalone/shim.js').read()
h=src
def rep(a,b,count=1):
    global h
    assert h.count(a)==count,(a[:70],h.count(a)); h=h.replace(a,b)
# logo compartilhado com a tela de login
m=re.search(r'const LOGO="(data:image/png;base64,[^"]+)";',h); logo=m.group(1)
rep(m.group(0),'const LOGO=window.__LOGO;')
# scripts: config + supabase + conexão, antes do script principal
rep('<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>',
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>\n<script src="config.js"></script>\n<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>')
i=h.rindex('<script>\n{\nconst $=')
h=h[:i]+'<script>window.__LOGO="'+logo+'";</script>\n<script>\n'+shim+'\n</script>\n'+h[i:]
# textos que falavam do Claude
rep('Você é administrador porque é dono ou editor do app no Claude. Para alguém novo conseguir abrir o app, compartilhe o link com essa pessoa no Claude, como Contribuidor.',
    'Para colocar alguém novo: envie o link do app. A pessoa cria a conta com e-mail e senha, preenche o cadastro e aparece aqui como pendente. Você libera e escolhe o perfil.')
rep('"Você ainda não tem permissão para se cadastrar. Peça ao administrador para compartilhar o app com você como Contribuidor."','"Não foi possível enviar o cadastro. Tente de novo."')
rep('"Só o dono ou editores do app podem liberar acessos."','"Só administradores podem liberar acessos."')
rep('peça acesso de Contribuidor','fale com o administrador')
rep('<option value="leitura">Somente leitura</option></select></label>','<option value="leitura">Somente leitura</option><option value="admin">Administrador (libera usuários)</option></select></label>')
rep('<td>${a.papel==="leitura"?"Somente leitura":a.papel==="operador"?"Operador":"—"}</td>','<td>${a.papel==="leitura"?"Somente leitura":a.papel==="operador"?"Operador":a.papel==="admin"?"Administrador":"—"}</td>')
os.makedirs('dist',exist_ok=True)
open('dist/index.html','w').write(h)
if not os.path.exists('dist/config.js'):
    open('dist/config.js','w').write('''// Configuração do Gestão de Carregamento
// No Supabase: Project Settings → API (ou Data API). Copie:
//   - Project URL            → supabaseUrl
//   - anon / public key      → supabaseKey   (NUNCA use a service_role aqui)
window.APP_CONFIG = {
  supabaseUrl: "",
  supabaseKey: ""
};
''')
print('ok',len(h))
