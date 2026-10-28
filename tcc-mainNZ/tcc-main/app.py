from flask import Flask, request, redirect, render_template, session
import sqlite3

app = Flask(__name__, template_folder=".")

app.secret_key = "bellievie123"


def conectar_banco():
    banco = sqlite3.connect("banco.db")
    banco.row_factory = sqlite3.Row
    return banco


@app.route("/")
def inicio():
    return render_template("login.html")


@app.route("/login", methods=["POST"])
def login():

    email = request.form["email"]
    senha = request.form["senha"]

    banco = conectar_banco()

    usuario = banco.execute(
        "SELECT * FROM usuarios WHERE email = ? AND senha = ?",
        (email, senha)
    ).fetchone()

    banco.close()

    if usuario:

        session["usuario_id"] = usuario["id"]
        session["nome"] = usuario["nome"]
        session["email"] = usuario["email"]
        session["tipo"] = usuario["tipo"]

        if usuario["tipo"] == "gerente":
            return redirect("/gerente")

        return redirect("/usuario")

    return "E-mail ou senha incorretos"


@app.route("/usuario")
def usuario():

    if "usuario_id" not in session:
        return redirect("/")

    if session["tipo"] != "usuario":
        return redirect("/")

    return render_template("Usuários/dashboarda.html")


@app.route("/gerente")
def gerente():

    if "usuario_id" not in session:
        return redirect("/")

    if session["tipo"] != "gerente":
        return redirect("/")

    return render_template("Gerente/Dashboard.html")


@app.route("/logout")
def logout():

    session.clear()

    return redirect("/")


if __name__ == "__main__":
    app.run(debug=True)