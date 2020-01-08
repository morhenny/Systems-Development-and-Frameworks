<template>
  <div>
    <form @submit="addChallenge">
      <input type="text" v-model="challengeText" name="text" placeholder="Add Challenge..." />
      <input type="submit" value="Add" class="button" />
    </form>
  </div>
</template>

<script>
export default {
  name: "AddChallenge",
  data() {
    return {
      challengeText: "",
      currentId: 4
    };
  },
  methods: {
    addChallenge(e) {
      e.preventDefault();
      if (this.challengeText == "") {
        alert("You cannot give Challenges an empty name!");
        return;
      }
      let currentTime = Math.floor(Date.now() / 1000);
      const newChallenge = {
        id: this.currentId++,
        text: this.challengeText,
        done: false,
        expires: currentTime + 3600,
        expired: false
      };
      //Send to parent
      this.$emit("add-challenge", newChallenge);

      this.challengeText = "";
    }
  }
};
</script>

<style scoped>
form {
  display: flex;
  align-items: center;
  background: #a5d6a7;
}

input[type="text"] {
  flex: 10;
  margin-right: 5px;
  margin-left: 5px;
}
</style>