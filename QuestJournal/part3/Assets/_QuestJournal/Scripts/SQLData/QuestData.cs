using System;
using SQLite;

namespace QuestJournal.SQLData
{
    [Table("Quest")]
    public record QuestData(
        int Id,
        bool Enabled,
        long InputDate,
        [property: Column("title")] string Title,
        [property: Column("description")] string Description
    )  : SQLiteData(Id, Enabled, InputDate)
    {
        public QuestData() : this(0, true, DateTime.Now.Ticks, string.Empty, string.Empty) { }
    }
}