import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import Select from "./Select";

const blank = () => ({
  username: "",
  name: "",
  role: "user",
  password: "",
  active: true,
});
export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function load() {
    setUsers(await api("/users"));
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  function update(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(editing ? `/users/${editing}` : "/users", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(form),
      });
      setForm(blank());
      setEditing(null);
      await load();
      setNotice(
        "Account saved. Changes to an existing account require it to sign in again.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="account-grid">
      <section className="card workflow-card">
        <div className="section-title">
          <h2>Accounts & roles</h2>
        </div>
        <div className="table-scroll">
          <table className="saved-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Role</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.username}</td>
                  <td>{user.role === "admin" ? "Admin" : "User"}</td>
                  <td>{user.active ? "Active" : "Disabled"}</td>
                  <td>
                    <button
                      className="button"
                      onClick={() => {
                        setEditing(user.id);
                        setForm({ ...user, password: "" });
                        setNotice("");
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <form className="card account-form" onSubmit={save}>
        <h2>{editing ? "Edit account" : "Create account"}</h2>
        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}
        {notice && <p role="status">{notice}</p>}
        <label>
          Name
          <input
            required
            maxLength={120}
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
          />
        </label>
        <label>
          Username
          <input
            required
            minLength={3}
            maxLength={80}
            pattern="[a-zA-Z0-9._-]+"
            autoComplete="off"
            value={form.username}
            onChange={(e) => update("username", e.target.value)}
          />
        </label>
        <label>
          Role
          <Select
            value={form.role}
            onChange={(e) => update("role", e.target.value)}
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </Select>
        </label>
        <label>
          {editing ? "New password (leave blank to keep)" : "Password"}
          <input
            type="password"
            autoComplete="new-password"
            required={!editing}
            minLength={10}
            maxLength={128}
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => update("active", e.target.checked)}
          />
          Active account
        </label>
        <div className="workflow-actions">
          <button className="button primary" disabled={busy}>
            {busy ? "Saving…" : "Save account"}
          </button>
          {editing && (
            <button
              className="button"
              type="button"
              onClick={() => {
                setEditing(null);
                setForm(blank());
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
