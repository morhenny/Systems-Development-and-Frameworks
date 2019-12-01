import { mount } from "@vue/test-utils"
import Todo from "./Todo.vue"
describe("Todo.vue", () => {
    describe("given a Todo", () =>{
        const wrapper = mount(Todo, {
            propsData: {
                todo: {
                    id: 1,
                    text: "Abrechnen",
                    done: false
                }
            }
        })
        test("renders todo.text correctly", () =>{
            expect(wrapper.text()).toContain("Abrechnen")
        })
        test("Todo item is unchecked", () =>{
           expect(wrapper.props().todo.done).toBe(false)
        })
        test("the first item has the id 1", () =>{
            expect(wrapper.props().todo.id).toBe(1)
        })
        test("does not render the input text field", () =>{
            expect(wrapper.vm.editing).toBe(false)
        })
        describe("click on Edit", () => {
            test("renders the input text field correctly", () =>{
                wrapper.find("button").trigger("click")
                expect(wrapper.vm.editing).toBe(true)
            })
            test("the text in the text field is empty", () =>{
                expect(wrapper.vm.newTodoText).toEqual("")
            })
            describe("enter a new text and submit", () => {
                test("the text is succesfully changed", () =>{
                    wrapper.find("input.main-content").setValue("newText")
                    expect(wrapper.vm.newTodoText).toEqual("newText")
                    wrapper.find("button").trigger("click")
                })
                describe("click on Delete", () => {
                    test("$emits \"delete-todo\"", () =>{
                        wrapper.findAll("button").at(1).trigger("click")
                        expect(wrapper.emitted("delete-todo")).toBeTruthy()
                    })
                })
            })
        })
    })
})