import sqlite3
from pathlib import Path

# Pega a pasta onde este arquivo Python está
pasta_projeto = Path(__file__).parent

# Caminhos dos arquivos
arquivo_sql = pasta_projeto / "banco_topzão.sql"
arquivo_banco = pasta_projeto / "banco.db"

# Conecta ao banco SQLite
conexao = sqlite3.connect(arquivo_banco)

cursor = conexao.cursor()

# Abre o arquivo SQL
with open(arquivo_sql, "r", encoding="utf-8") as arquivo:
    comando_sql = arquivo.read()

# Executa os comandos SQL
cursor.executescript(comando_sql)

# Salva
conexao.commit()

# Fecha
conexao.close()

print("Banco criado com sucesso!")