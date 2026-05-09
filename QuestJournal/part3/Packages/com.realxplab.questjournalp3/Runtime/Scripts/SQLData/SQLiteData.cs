using System;
using SQLite;

namespace QuestJournal.SQLData
{
    public record SQLiteData(
        [property: Column("id"), PrimaryKey, AutoIncrement] int Id,
        [property: Column("enabled")] bool Enabled,
        [property: Column("input_date")] long InputDate)
    {
        public SQLiteData() : this(0, true, DateTime.Now.Ticks) { }
    }
}