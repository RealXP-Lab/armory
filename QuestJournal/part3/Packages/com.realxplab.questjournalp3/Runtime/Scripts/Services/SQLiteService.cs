using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Linq.Expressions;
using QuestJournal.SQLData;
using SQLite;
using UnityEngine;

namespace QuestJournal.Services
{
    public class SQLiteService : IDisposable
    {
        SQLiteConnection connection;
        bool disposed;

        public SQLiteService(string databaseName)
        {
            var fullName = Path.ChangeExtension(databaseName, "db");
            var path = Path.Combine(Application.persistentDataPath, fullName);
            connection = new SQLiteConnection(path);
        }

        public void Dispose()
        {
            if (disposed)
                return;

            connection?.Close();
            connection?.Dispose();
            disposed = true;
        }

        public void CreateTable<T>() where T : SQLiteData, new() =>
            connection.CreateTable<T>();

        public void Insert<T>(T data) where T : SQLiteData, new() =>
            connection.Insert(data);

        public List<T> GetAll<T>() where T : SQLiteData, new() =>
            connection.Table<T>().ToList();

        public List<T> GetAllBy<T>(Expression<Func<T, bool>> filter) where T : SQLiteData, new() =>
            connection.Table<T>().Where(filter).ToList();

        public T Find<T>(int id) where T : SQLiteData, new() =>
            connection.Find<T>(id);

        public T Find<T>(Expression<Func<T, bool>> filter) where T : SQLiteData, new() =>
            connection.Find<T>(filter);

        public void Update<T>(T data) where T : SQLiteData, new() =>
            connection.Update(data);

        public void UpdateAll<T>(IEnumerable<T> data) where T : SQLiteData, new() =>
            connection.UpdateAll(data);

        public void Delete<T>(T data) where T : SQLiteData, new() =>
            connection.Delete<T>(data.Id);

        public void Disable<T>(T data) where T : SQLiteData, new() =>
            connection.Update(data with { Enabled = false });

        public bool IsTableEmpty<T>() where T : SQLiteData, new() =>
            !connection.Table<T>().Any();

        public TableQuery<T> GetTableQuery<T>() where T : SQLiteData, new() =>
            connection.Table<T>();
    }
}