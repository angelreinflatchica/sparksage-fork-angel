from discord.ext import commands
from discord import app_commands
import discord
import db as database

class Permissions(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    permissions_group = app_commands.Group(
        name="permissions", 
        description="Manage command role restrictions",
        default_permissions=discord.Permissions(administrator=True)
    )

    @permissions_group.command(name="set", description="Require a specific role for a command")
    @app_commands.describe(
        command="The name of the command (e.g., ask, review)",
        role="The role required to use this command"
    )
    async def permissions_set(self, interaction: discord.Interaction, command: str, role: discord.Role):
        db = await database.get_db()
        await db.execute(
            "INSERT OR IGNORE INTO command_permissions (command_name, guild_id, role_id) VALUES (?, ?, ?)",
            (command.lower(), str(interaction.guild_id), str(role.id))
        )
        await db.commit()
        await interaction.response.send_message(f"Command `/{command}` now requires the **{role.name}** role.")

    @permissions_group.command(name="remove", description="Remove a role requirement from a command")
    @app_commands.describe(
        command="The name of the command",
        role="The role to remove"
    )
    async def permissions_remove(self, interaction: discord.Interaction, command: str, role: discord.Role):
        db = await database.get_db()
        await db.execute(
            "DELETE FROM command_permissions WHERE command_name = ? AND guild_id = ? AND role_id = ?",
            (command.lower(), str(interaction.guild_id), str(role.id))
        )
        await db.commit()
        await interaction.response.send_message(f"Removed **{role.name}** requirement from `/{command}`.")

    @permissions_group.command(name="list", description="List all command role restrictions")
    async def permissions_list(self, interaction: discord.Interaction):
        db = await database.get_db()
        cursor = await db.execute(
            "SELECT command_name, role_id FROM command_permissions WHERE guild_id = ?",
            (str(interaction.guild_id),)
        )
        rows = await cursor.fetchall()
        
        if not rows:
            await interaction.response.send_message("No command restrictions configured.")
            return
            
        msg = "**Command Role Restrictions:**\n"
        for row in rows:
            role = interaction.guild.get_role(int(row['role_id']))
            role_name = role.name if role else f"Unknown Role ({row['role_id']})"
            msg += f"- `/{row['command_name']}`: {role_name}\n"
            
        await interaction.response.send_message(msg)

async def setup(bot):
    await bot.add_cog(Permissions(bot))
